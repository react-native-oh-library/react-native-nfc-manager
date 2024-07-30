/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { RNOHContext, TurboModule } from '@rnoh/react-native-openharmony/ts';
import { TM } from "@rnoh/react-native-openharmony/generated/ts"
import { nfcController } from '@kit.ConnectivityKit';
const TAG: string = '[NfcManagerModule====>]';
import Logger from './utils/Logger';
import { bundleManager, common, Want } from '@kit.AbilityKit';
import { tag } from '@kit.ConnectivityKit';
import { BusinessError, Callback } from '@kit.BasicServicesKit';
import { Constants } from './constants/Constants';
import TagTechnologyRequest from './nfc/TagTechnologyRequest';
import Util from './utils/Util';
import NFCReadManager from './NFCReadManager';
import { NfcAdapter } from './model/NfcAdapter';

export type TurboModuleContext = RNOHContext;

export class RNNfcManagerModule extends TurboModule implements TM.NfcManager.Spec {

  private isForegroundEnabled:boolean = false;
  private isForeground:boolean = false;

  private isReaderModeEnabled:boolean = false;
  private readerModeFlags:number = 0;
  private readerModeDelay:number = 0;
  private techRequest:TagTechnologyRequest = null;
  private discTech: number[] = []; // replace with the tech(s) that is needed by foreground ability
  private bgTag:TM.NfcManager.TagEvent | null = null;
  private nfcTagInfo: tag.TagInfo | null = null;
  private static abilityEvents:Set<string> =  new Set();

  constructor(ctx: TurboModuleContext) {
    super(ctx);
    this.getAppState();
    this.subscribeListeners();
  }

  getConstants(): Object {
    let object = {
      "MIFARE_BLOCK_SIZE":Constants.MIFARE_BLOCK_SIZE,
      'MIFARE_ULTRALIGHT_PAGE_SIZE': Constants.MIFARE_ULTRALIGHT_PAGE_SIZE,
      'MIFARE_ULTRALIGHT_TYPE': tag.MifareUltralightType.TYPE_ULTRALIGHT,
      'MIFARE_ULTRALIGHT_TYPE_C':tag.MifareUltralightType.TYPE_ULTRALIGHT_C,
      'MIFARE_ULTRALIGHT_TYPE_UNKNOWN':tag.MifareUltralightType.TYPE_UNKNOWN,
    }
    return object
  }

  static registerAbilityEvents(context:common.UIAbilityContext,event:string,want:Want) {
    console.info('NfcManagerModule ===> registerAbilityEvents' + event)
    console.info('NfcManagerModule ===> registerAbilityEvents ' + JSON.stringify(want))
    switch (event) {
      case "onCreate":
        NFCReadManager.getInstance().setLaunchWant(want);
        break;
      case "onNewWant":
        console.info('NfcManagerModule ===> onNewWant' + event)
        NFCReadManager.getInstance().setLaunchWant(want);
        context.eventHub.emit(event,want);
        break;
    }
  }

  static unRegisterAbilityEvents(context:common.UIAbilityContext) {
    this.abilityEvents.forEach(event => {
      context.eventHub.off(event);
    })
    this.abilityEvents.clear();
    NFCReadManager.getInstance().close();
  }

  subscribeListeners() {
    this.ctx.rnInstance.subscribeToLifecycleEvents(Constants.KEY_FOREGROUND,this.onAbilityForeground.bind(this))
    this.ctx.rnInstance.subscribeToLifecycleEvents(Constants.KEY_BACKGROUND,this.onAbilityBackground.bind(this));
    this.ctx.uiAbilityContext.eventHub.on('onNewWant',this.onAbilityNewWant.bind(this))
  }

  getAppState() {
    const isActive = this.ctx.getUIAbilityState();
    this.isForeground = isActive === Constants.KEY_FOREGROUND;
  }

  //注册
  onAbilityCreate(want:Want) {
    console.info('NfcManagerModule ===> onCreate' + want);
    NFCReadManager.getInstance().setLaunchWant(want);
  }

  onAbilityNewWant(want: Want) {
    console.info('NfcManagerModule ===> onNewWant' + JSON.stringify(want));
    let nfcTag:TM.NfcManager.TagEvent = this.parseNfcWant(want);
    if(nfcTag !== null) {
      if(this.isForegroundEnabled) {
        this.sendEvent('NfcManagerDiscoverTag',nfcTag);
      } else {
        this.sendEvent('NfcManagerDiscoverBackgroundTag',nfcTag);
        this.bgTag = nfcTag;
      }
    }
  }

  onAbilityForeground(): void {
    console.info(TAG,'onAbilityForeground')
    this.isForeground = true;
    if(this.isForegroundEnabled) {
      this.enableDisableForegroundDispatch(true);
    }
  }

  onAbilityBackground(): void {
    console.info(TAG,'onAbilityBackground')
    this.isForeground = false;
    this.enableDisableForegroundDispatch(false);
  }

  mifareClassicSectorToBlock(sector: number): Promise<number> {
    if(this.techRequest !== null) {
      try {
        let mifareClassic: tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
        if (mifareClassic === null || mifareClassic.getType() === tag.MifareClassicType.TYPE_UNKNOWN) {
          return Promise.reject('mifareClassicSectorToBlock fail: TYPE_UNKNOWN')
        } else if(sector >= mifareClassic.getSectorCount()) {
          let msg =  `mifareClassicSectorToBlock fail: invalid sector ${sector} (max ${mifareClassic.getSectorCount()})`
          return Promise.reject(msg);
        }
        return Promise.resolve(mifareClassic.getBlockIndex(sector));
      } catch (error) {
        return Promise.reject("mifareClassicSectorToBlock fail:")
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  async mifareClassicReadBlock(block: number): Promise<number[]> {
    console.info('ReadBlock ====' + block)
    if(this.techRequest !== null) {
      try {
        let mifareClassic: tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
        console.info('ReadBlock ====' + mifareClassic.getType())
        if (mifareClassic === null || mifareClassic.getType() === tag.MifareClassicType.TYPE_UNKNOWN) {
          return Promise.reject('mifareClassicSectorToBlock fail: TYPE_UNKNOWN')
        }
        let result:number[] = await mifareClassic.readSingleBlock(block);
        console.info('ReadBlock ====' + result)
        return Promise.resolve(result);
      } catch (error) {
        return Promise.reject(JSON.stringify(error))
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  mifareClassicWriteBlock(block: number, data: number[]): Promise<void> {
    if(this.techRequest !== null) {
      try {
        let mifareClassic: tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
        if (mifareClassic === null || mifareClassic.getType() === tag.MifareClassicType.TYPE_UNKNOWN) {
          return Promise.reject('mifareClassicSectorToBlock fail: TYPE_UNKNOWN')
        } else if(data.length !== Constants.MIFARE_BLOCK_SIZE) {
          let msg = `mifareClassicWriteBlock fail: invalid block size ${data.length} (should be ${Constants.MIFARE_BLOCK_SIZE})`;
          return Promise.reject(msg)
        }
        mifareClassic.writeSingleBlock(block,data);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject("mifareClassicWriteBlock fail: ")
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  mifareClassicIncrementBlock(block:number, data: number) : Promise<void> {
    if(this.techRequest !== null) {
      try {
        let mifareClassic: tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
        if(mifareClassic === null || mifareClassic.getType() === tag.MifareClassicType.TYPE_UNKNOWN) {
          return Promise.reject('mifareClassicSectorToBlock fail: TYPE_UNKNOWN')
        }
        if (!mifareClassic.isConnected()) {
          return Promise.reject('mifareClassic connectTag failed.')
        }
        mifareClassic.incrementBlock(block,data);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject("mifareClassicIncrementBlock fail:")
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  mifareClassicTransferBlock(block: number) : Promise<void> {
    if(this.techRequest !== null) {
      try {
        let mifareClassic: tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
        if(mifareClassic === null || mifareClassic.getType() === tag.MifareClassicType.TYPE_UNKNOWN) {
          return Promise.reject('mifareClassicSectorToBlock fail: TYPE_UNKNOWN')
        }
        mifareClassic.transferToBlock(block);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject("mifareClassicTransferBlock fail:")
      }
    }else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  mifareClassicDecrementBlock(block: number,data:number) : Promise<void> {
    if(this.techRequest !== null) {
      try {
        let mifareClassic: tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
        if(mifareClassic === null || mifareClassic.getType() === tag.MifareClassicType.TYPE_UNKNOWN) {
          return Promise.reject('mifareClassicSectorToBlock fail: TYPE_UNKNOWN')
        }
        mifareClassic.decrementBlock(block,data);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject("mifareClassicDecrementBlock fail:")
      }
    }else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  mifareClassicGetSectorCount() : Promise<number> {
    if(this.techRequest !== null) {
      try {
        let mifareClassic: tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
        if(mifareClassic === null || mifareClassic.getType() === tag.MifareClassicType.TYPE_UNKNOWN) {
          return Promise.reject('mifareClassicSectorToBlock fail: TYPE_UNKNOWN')
        }
        if(!mifareClassic.isConnected()) {
          return Promise.reject('mifareClassic connectTag failed.')
        }
       return Promise.resolve(mifareClassic.getSectorCount());
      } catch (error) {
        return Promise.reject("mifareClassicDecrementBlock fail:")
      }
    }else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  mifareClassicAuthenticateA(sectorIndex:number,key:	number[]):Promise<void>{
    return this.mifareClassicAuthenticate('isKeyA',sectorIndex,key);
  }

  mifareClassicAuthenticateB(sectorIndex:number,key:	number[]):Promise<void>{
    return this.mifareClassicAuthenticate('isKeyB',sectorIndex,key);
  }

  mifareClassicAuthenticate(type:string,sectorIndex:number,key:	number[]):Promise<void> {
    if(this.techRequest !== null) {
      try {
        let mifareClassic: tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
        if(mifareClassic === null || mifareClassic.getType() === tag.MifareClassicType.TYPE_UNKNOWN) {
          return Promise.reject('mifareClassicSectorToBlock fail: TYPE_UNKNOWN')
        } else if(sectorIndex >= mifareClassic.getSectorCount()) {
          let msg = `mifareClassicAuthenticate fail: invalid sector ${sectorIndex} (max ${mifareClassic.getSectorCount()})`
          return Promise.reject(msg);
        } else if(key.length !== 6) {
          let msg = `mifareClassicAuthenticate fail: invalid key (needs length 6 but has ${key.length} characters)`
          return Promise.reject(msg);
        }
        mifareClassic.authenticateSector(sectorIndex,key,type === 'isKeyA' ? true : false);
        console.info(TAG,'mifareClassicAuthenticate === ' + true);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject("mifareClassicDecrementBlock fail:")
      }
    }else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  async mifareUltralightReadPages(offset:number):Promise<number[]> {
    if(this.techRequest !== null) {
      try {
        let mifareUltralightTag: tag.MifareUltralightTag = this.techRequest.getTechHandle() as tag.MifareUltralightTag;
        if(mifareUltralightTag === null) {
          return Promise.reject(Constants.ERR_API_NOT_SUPPORT);
        }
        let result:number[] = await mifareUltralightTag.readMultiplePages(offset);
        return Promise.resolve(result);
      } catch (error) {
        return Promise.reject("mifareUltralightReadPages fail:"+ JSON.stringify(error))
      }
    }else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  mifareUltralightWritePage(offset: number,data: number[]):Promise<void> {
    if(this.techRequest !== null) {
      try {
        let mifareUltralightTag: tag.MifareUltralightTag = this.techRequest.getTechHandle() as tag.MifareUltralightTag;
        if(mifareUltralightTag === null) {
          return Promise.reject(Constants.ERR_API_NOT_SUPPORT);
        }
        mifareUltralightTag.writeSinglePage(offset,data);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject("mifareUltralightWritePage fail:"+ JSON.stringify(error))
      }
    }else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  formatNdef(bytes: number[], options?: { readOnly: boolean }):Promise<void> {
    let readOnly = options?.readOnly;
    if(this.techRequest !== null) {
      try {
        let ndefFormatable: tag.NdefFormatableTag = this.techRequest.getTechHandle() as tag.NdefFormatableTag;
        if(ndefFormatable === null) {
          return Promise.reject('mifareUltralightWritePage fail');
        } else {
          let ndefMessage = tag.ndef.createNdefMessage(bytes);
          if(readOnly) {
            ndefFormatable.formatReadOnly(ndefMessage);
          } else {
            ndefFormatable.format(ndefMessage);
          }
        }
        return Promise.resolve();
      } catch (error) {
        return Promise.reject("formatNdef fail:"+ JSON.stringify(error))
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }


  connect(techs:TM.NfcManager.NfcTech[]): Promise<void> {
    try {
      this.techRequest = new TagTechnologyRequest(techs);
      this.techRequest.setNFCReadResultListener((err,data) => {
        if(!err){
          Logger.info(' techs connect ' + JSON.stringify(data))
        }
      })
      let isConnect =  this.techRequest.onConnect(this.nfcTagInfo);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(Constants.ERR_NO_NFC_SUPPORT);
    }
  }

  close(): Promise<void> {
    try {
      this.techRequest.close();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(JSON.stringify(error));
    }
  }

  goToNfcSetting(): Promise<boolean> {
    try {
      let context = this.ctx.uiAbilityContext;
      context.startAbility({
        bundleName: 'com.huawei.hmos.settings',
        abilityName: 'com.huawei.hmos.settings.MainAbility',
        uri:"nfc_settings",
      })
      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  getLaunchTagEvent(): Promise<TM.NfcManager.TagEvent | null>{
    let want = NFCReadManager.getInstance().getBackgroundWant();
    let nfcTag: TM.NfcManager.TagEvent = this.parseNfcWant(want);
    return Promise.resolve(nfcTag);
  }

  getMaxTransceiveLength(): Promise<number>{
    if(this.techRequest !== null) {
      let max: number = -1;
      let techType = this.techRequest.getTechType();
      try {
        switch (techType) {
          case 'NfcA':
            let nfcA:tag.NfcATag = this.techRequest.getTechHandle() as tag.NfcATag;
            max = nfcA.getMaxTransmitSize();
            break;
          case 'NfcB':
            let nfcB:tag.NfcBTag = this.techRequest.getTechHandle() as tag.NfcBTag;
            max = nfcB.getMaxTransmitSize();
            break;
          case 'NfcF':
            let nfcF:tag.NfcFTag = this.techRequest.getTechHandle() as tag.NfcFTag;
            max = nfcF.getMaxTransmitSize();
            break;
          case 'NfcV':
            let nfcV:tag.NfcVTag = this.techRequest.getTechHandle() as tag.NfcVTag;
            max = nfcV.getMaxTransmitSize();
            break;
          case 'IsoDep':
            let isoDep:tag.IsoDepTag = this.techRequest.getTechHandle() as tag.IsoDepTag;
            max = isoDep.getMaxTransmitSize();
            break;
          case 'MifareClassic':
            let mifareClassic:tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
            max = mifareClassic.getMaxTransmitSize();
            break;
          case 'MifareUltralight':
            let mifareUltralight:tag.MifareUltralightTag = this.techRequest.getTechHandle() as tag.MifareUltralightTag;
            max = mifareUltralight.getMaxTransmitSize();
            break;
        }
      } catch (error) {
        Logger.info(TAG,"getMaxTransceiveLength fail: " + JSON.stringify(error))
        return Promise.reject(Constants.ERR_TRANSCEIVE_FAIL)
      }
      if(max === -1) {
        return Promise.reject(Constants.ERR_NO_NFC_SUPPORT);
      }
      return Promise.resolve(max);
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  setTimeout(timeout: number): Promise<void> {
    if(this.techRequest !== null) {
      let techType = this.techRequest.getTechType();
      let tagSession:tag.TagSession = this.techRequest.getTechHandle()
      try {
        switch (techType) {
          case 'NfcA':
            let nfcA:tag.NfcATag = tagSession as tag.NfcATag;
            nfcA.setTimeout(timeout);
            return Promise.resolve();
          case 'NfcB':
            let nfcB:tag.NfcBTag = tagSession as tag.NfcBTag;
            nfcB.setTimeout(timeout);
            return Promise.resolve();
          case 'NfcF':
            let nfcF:tag.NfcFTag = tagSession as tag.NfcFTag;
            nfcF.setTimeout(timeout);
            return Promise.resolve();
          case 'NfcV':
            let nfcV:tag.NfcVTag = tagSession as tag.NfcVTag;
            nfcV.setTimeout(timeout);
            return Promise.resolve();
          case 'IsoDep':
            let isoDep:tag.IsoDepTag = tagSession as tag.IsoDepTag;
            isoDep.setTimeout(timeout);
            return Promise.resolve();
          case 'MifareClassic':
            let mifareClassic:tag.MifareClassicTag = tagSession as tag.MifareClassicTag;
            mifareClassic.setTimeout(timeout);
            return Promise.resolve();
          case 'MifareUltralight':
            let mifareUltralight:tag.MifareUltralightTag = tagSession as tag.MifareUltralightTag;
            mifareUltralight.setTimeout(timeout);
            return Promise.resolve();
        }
      } catch (error) {
        Logger.info(TAG,"transceive fail: " + JSON.stringify(error))
        return Promise.reject(Constants.ERR_TRANSCEIVE_FAIL)
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  async transceive(bytes: number[]): Promise<number[]> {
    if(this.techRequest !== null) {
      let resultBytes: number[] = []
      let techType = this.techRequest.getTechType();
      try {
        switch (techType) {
          case 'NfcA':
            let nfcA:tag.NfcATag = this.techRequest.getTechHandle() as tag.NfcATag;
            console.info('transceive === ' + JSON.stringify(nfcA));
            resultBytes = await nfcA.transmit(bytes);
            break;
          case 'NfcB':
            let nfcB:tag.NfcBTag = this.techRequest.getTechHandle() as tag.NfcBTag;
            resultBytes = await nfcB.transmit(bytes);
            break;
          case 'NfcF':
            let nfcF:tag.NfcFTag = this.techRequest.getTechHandle() as tag.NfcFTag;
            resultBytes = await nfcF.transmit(bytes);
            break;
          case 'NfcV':
            let nfcV:tag.NfcVTag = this.techRequest.getTechHandle() as tag.NfcVTag;
            resultBytes = await nfcV.transmit(bytes);
            break;
          case 'IsoDep':
            let isoDep:tag.IsoDepTag = this.techRequest.getTechHandle() as tag.IsoDepTag;
            console.info('transceive === ' + JSON.stringify(isoDep));
            resultBytes = await isoDep.transmit(bytes);
            break;
          case 'MifareClassic':
            let mifareClassic:tag.MifareClassicTag = this.techRequest.getTechHandle() as tag.MifareClassicTag;
            resultBytes = await mifareClassic.transmit(bytes);
            break;
          case 'MifareUltralight':
            let mifareUltralight:tag.MifareUltralightTag = this.techRequest.getTechHandle() as tag.MifareUltralightTag;
            resultBytes = await mifareUltralight.transmit(bytes);
            break;
        }
      } catch (error) {
        Logger.info(TAG,"transceive fail: " + JSON.stringify(error))
        return Promise.reject(Constants.ERR_TRANSCEIVE_FAIL)
      }
      if(resultBytes === null || resultBytes.length === 0) {
        return Promise.reject(Constants.ERR_NO_NFC_SUPPORT);
      }
      console.info('resultBytes == '+ resultBytes.toString())
      return Promise.resolve(resultBytes);
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  async writeNdefMessage(bytes: number[], options: { reconnectAfterWrite: boolean; }): Promise<void> {
    let reconnectAfterWrite = options.reconnectAfterWrite;
    if(this.techRequest != null) {
      try {
        let ndef:tag.NdefTag  = this.techRequest.getTechHandle() as tag.NdefTag;
        if(ndef === null) {
          return Promise.reject(Constants.ERR_API_NOT_SUPPORT);
        } else {
          console.info('ndef.isNdefWritabl ====' + ndef.isNdefWritable())
          let ndefMessage : tag.NdefMessage = tag.ndef.createNdefMessage(bytes);
          await ndef.writeNdef(ndefMessage);
          if(reconnectAfterWrite) {
            // 再次连接连接tag
            ndef.resetConnection();
          }
          return Promise.resolve();
        }
      } catch (error) {
        Logger.error(TAG,'ndef writeNdef Promise catch businessError Code: '+ JSON.stringify(error))
        return Promise.reject(JSON.stringify(error))
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ)
    }
  }

  getNdefMessage(): Promise<TM.NfcManager.TagEvent | null> {
    if(this.techRequest !== null) {
      try {
        let ndef:tag.NdefTag  = this.techRequest.getTechHandle() as tag.NdefTag;
        let parsed:TM.NfcManager.TagEvent = {};
        parsed.ndefMessage = Util.messageToNdefRecord(ndef.getNdefMessage())
        parsed.type = 'NDEF';
        return Promise.resolve(parsed);
      } catch (error) {
        Logger.error(TAG,'ndef getNdefMessage Promise catch businessError Code: '+ JSON.stringify(error))
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ)
    }
  }

  async makeReadOnly(): Promise<boolean> {
    if(this.techRequest !== null) {
      try {
        let ndef:tag.NdefTag  = this.techRequest.getTechHandle() as tag.NdefTag;
        await ndef.setReadOnly();
        return Promise.resolve(true)
      } catch (error) {
        return Promise.resolve(false)
      }
    }else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ)
    }
  }

  getNdefStatus(): Promise<TM.NfcManager.TagEvent> {
    if (this.techRequest !== null) {
      let parsed:TM.NfcManager.TagEvent = {};
      try {
        let ndef:tag.NdefTag  = this.techRequest.getTechHandle() as tag.NdefTag;
        parsed.maxSize = ndef.getMaxTransmitSize();
        parsed.isWritable = ndef.isNdefWritable();
        parsed.canMakeReadOnly = ndef.canSetReadOnly();
        return Promise.resolve(parsed);
      } catch (error) {
        Logger.info(TAG,'getNdefStatus error ===> ' + JSON.stringify(error))
        return Promise.reject(JSON.stringify(error));
      }
    }else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  getCachedNdefMessage(): Promise<TM.NfcManager.TagEvent | null> {
    if (this.techRequest !== null) {
      let parsed:TM.NfcManager.TagEvent = {};
      try {
        let ndef:tag.NdefTag  = this.techRequest.getTechHandle() as tag.NdefTag;
        parsed = Util.ndefToTagEvent(ndef,this.techRequest.getTagHandle());
        return Promise.resolve(parsed)
      } catch (error) {
        Logger.info(TAG,'getCachedNdefMessage error ===> ' + JSON.stringify(error))
        return Promise.reject(JSON.stringify(error));
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  clearBackgroundTag(): Promise<void> {
    this.bgTag = null;
    return Promise.resolve();
  }

  getBackgroundTag(): Promise<TM.NfcManager.TagEvent | null> {
    return Promise.resolve(this.bgTag);
  }

  getTag(): Promise<TM.NfcManager.TagEvent | null> {
    if(this.techRequest !== null) {
      let nfcTagInfo: tag.TagInfo = this.techRequest.getTagHandle();
      if(tag !== null) {
        let parsed:TM.NfcManager.TagEvent = Util.tagToTagEvent(nfcTagInfo);
        if(nfcTagInfo.technology.includes(tag.NDEF)) {
          try {
            let ndef:tag.NdefTag  = tag.getNdef(nfcTagInfo);
            parsed = Util.ndefToTagEvent(ndef,nfcTagInfo);
          } catch (error) {
            Logger.info(TAG,'getTag ===> ' + JSON.stringify(error))
          }
        }
        return Promise.resolve(parsed);
      } else {
        return Promise.reject(Constants.ERR_NO_REFERENCE)
      }
    } else {
      return Promise.reject(Constants.ERR_NO_TECH_REQ);
    }
  }

  cancelTechnologyRequest(): Promise<void> {
    if(this.techRequest !== null) {
      this.techRequest.close();
      this.techRequest.invokePendingCallbackWithError(Constants.ERR_CANCEL);
    }
    this.techRequest = null;
    return Promise.resolve();
  }

  hasTagEventRegistration():Promise<boolean> {
    Logger.info(TAG,"isSessionAvailable: " + this.isForegroundEnabled)
    return Promise.resolve(this.isForegroundEnabled)
  }

  builderElementName() {
    Logger.info('TAG',"nfc state onCreate want: ")
    let elementName = {
      bundleName: this.ctx.uiAbilityContext.abilityInfo.bundleName as string,
      abilityName: this.ctx.uiAbilityContext.abilityInfo.name as string,
      moduleName: this.ctx.uiAbilityContext.abilityInfo.moduleName as string
    }
    return elementName;
  }
  builderDiscTech(readerModeFlags:number) {
    let discTech:number[] = []
     switch (readerModeFlags) {
       case NfcAdapter.FLAG_READER_NFC_A:
         discTech.push(tag.NFC_A);
         break;
       case NfcAdapter.FLAG_READER_NFC_B:
         discTech.push(tag.NFC_B);
         break;
       case NfcAdapter.FLAG_READER_NFC_F:
         discTech.push(tag.NFC_F);
         break;
       case NfcAdapter.FLAG_READER_NFC_V:
         discTech.push(tag.NFC_V);
         break;
       default :
         discTech = [tag.NFC_A, tag.NFC_B];
         break
     }
     return discTech
   }

  hasPendingRequest() {
    return this.techRequest !== null ? true : false;
  }

  requestTechnology(tech:TM.NfcManager.NfcTech[]): Promise<TM.NfcManager.NfcTech | null> {
    return new Promise((resolve,reject) => {
      if(!this.isForegroundEnabled) {
        return reject(Constants.ERR_NOT_REGISTERED);
      }
      console.info('hasPendingRequest ====' + this.hasPendingRequest());
      if(this.hasPendingRequest()) {
        console.info('hasPendingRequest ====' + Constants.ERR_MULTI_REQ);
        return reject(Constants.ERR_MULTI_REQ)
      } else {
        this.techRequest = new TagTechnologyRequest(tech);
        this.techRequest.setNFCReadResultListener((err,data) => {
          if(err) {
            return reject(err);
          }
          console.log("foregroundCb: tag found tagInfo = ", JSON.stringify(data));
          return resolve(data);
        })
      }
    })
  }

  sendEvent(eventName: string, payload: any) {
    this.ctx.rnInstance.emitDeviceEvent(eventName,payload);
  }

  start():Promise<void>{
    //判断当前设置是否支持NDF
    let nfcAvailable = this.isSupported();
    if(!nfcAvailable) {
      Logger.info(TAG,"not support in this device")
      return Promise.reject(Constants.ERR_NO_NFC_SUPPORT)
    }
    this.registerNFCStateListener();
    this.bgTag = this.parseNfcWant(NFCReadManager.getInstance().getBackgroundWant());
    return Promise.resolve()
  }

  registerNFCStateListener() {
    //注册nfc是否打开监听
    nfcController.on("nfcStateChange",this.onStateChange.bind(this))
  }

  onStateChange(state:nfcController.NfcState) {
    Logger.info(TAG,"onReceive "+JSON.stringify(state));
    let stateStr = 'unknown';
    switch (state) {
      //NFC已关闭状态。
      case nfcController.NfcState.STATE_OFF:
        stateStr = 'off';
        break;
      //NFC正在打开状态。
      case nfcController.NfcState.STATE_TURNING_ON:
        stateStr = 'turning_off';
        break;
      //NFC已打开状态。
      case nfcController.NfcState.STATE_ON:
        stateStr = 'on';
        break;
      //NFC正在关闭状态。
      case nfcController.NfcState.STATE_TURNING_OFF:
        stateStr = "turning_on";
        break
    }
    let nfcManagerUpdateStateEvent =  {
      state:stateStr
    }
    console.info('NfcManagerStateChanged === ' + JSON.stringify(nfcManagerUpdateStateEvent))
    this.sendEvent("NfcManagerStateChanged",nfcManagerUpdateStateEvent);
  }

  isSupported(): Promise<boolean> {
    let isNfcAvailable = canIUse("SystemCapability.Communication.NFC.Core");
    return Promise.resolve(isNfcAvailable);
  }

  isEnabled(): Promise<boolean> {
    let isEnabled = nfcController.isNfcOpen();
    return Promise.resolve(isEnabled);
  }

  registerTagEvent(options: TM.NfcManager.RegisterTagEventOpts): Promise<void> {
    this.isReaderModeEnabled = options.isReaderModeEnabled;
    this.readerModeFlags = options.readerModeFlags;
    this.discTech = this.builderDiscTech(this.readerModeFlags);
    this.readerModeDelay = options.readerModeDelay;
    this.isForegroundEnabled = true;
    if(this.isForeground) {
      this.enableDisableForegroundDispatch(true);
    }
    return Promise.resolve();
  }

  enableDisableForegroundDispatch(enable:boolean){
    Logger.info(TAG,"enableForegroundDispatch, enable = " + enable);
    //是否订阅读卡事件
    if(this.isReaderModeEnabled) {
      this.readerModeEnabled(enable);
    } else {
      this.registerForegroundDispatch(enable);
    }
  }

  registerForegroundDispatch(enable:boolean) {
    if(enable) {
      tag.registerForegroundDispatch(this.builderElementName(),this.discTech, (err : BusinessError, tagInfo: tag.TagInfo): void => this.foregroundCb(err, tagInfo));
    } else {
      tag.unregisterForegroundDispatch(this.builderElementName())
    }
  }

  readerModeEnabled(enable:boolean) {
    if(enable) {
      Logger.info(TAG,"enableReaderMode: " + this.readerModeFlags)
     tag.on('readerMode',this.builderElementName(),this.discTech,(err : BusinessError, tagInfo: tag.TagInfo): void => this.readerModeCb(err, tagInfo))
    } else {
      tag.off('readerMode',this.builderElementName());
    }
  }

  readerModeCb(err : BusinessError, tagInfo : tag.TagInfo)  {
    if (!err) {
      this.onConnect(tagInfo);
    }
  }

  foregroundCb(err : BusinessError, tagInfo : tag.TagInfo) {
    if(!err) {
      //前序校验成功
      this.onConnect(tagInfo);
    }
  }

  onConnect(tagInfo : tag.TagInfo) {
    if(tagInfo !== null) {
      let nfcTag:TM.NfcManager.TagEvent = {}
      if(tagInfo.technology.includes(tag.NDEF)) {
        let ndef:tag.NdefTag  = tag.getNdef(tagInfo);
        nfcTag = Util.ndefToTagEvent(ndef,tagInfo);
      } else {
        nfcTag= Util.tagToTagEvent(tagInfo);
      }
      console.info('nfcTag ====> ' + JSON.stringify(nfcTag));
      if(nfcTag!== null) {
        this.sendEvent('NfcManagerDiscoverTag',nfcTag);
        Logger.info(TAG,"foregroundCb callback: tag found tagInfo = " + JSON.stringify(tagInfo))
        if(this.techRequest!= null && !this.techRequest.isConnected()) {
          let result = this.techRequest.onConnect(tagInfo);
          if(result) {
            this.techRequest.invokePendingCallback(this.techRequest.getTechType());
          } else {
            this.techRequest.invokePendingCallback(null);
          }
        }
      }
    }
  }

  unregisterTagEvent(): Promise<void> {
    Logger.info(TAG,"unregisterTagEvent");
    if(this.isForeground) {
      this.enableDisableForegroundDispatch(false);
    }
    this.isForegroundEnabled = false;
    this.isReaderModeEnabled = false;
    this.discTech = [];
    this.readerModeFlags = 0 ;
    this.readerModeDelay = 0;
    return Promise.resolve();
  }

  private parseNfcWant(want:Want):TM.NfcManager.TagEvent{
    Logger.info(TAG,'NfcManagerModule====> want ==' + JSON.stringify(want));
    if(want === null) {
      return null;
    }
    let nfcTagInfo : tag.TagInfo | null = null;
    try {
      nfcTagInfo = tag.getTagInfo(want);
    } catch (error) {
      Logger.error(TAG,"tag.getTagInfo catch error: " + error);
    }
     Logger.info(TAG,'NfcManagerModule====> nfcTagInfo ==' + JSON.stringify(nfcTagInfo));
    if (nfcTagInfo == null || nfcTagInfo.technology == null) {
      Logger.info(TAG,"NfcManagerModule====> no TagInfo to be created, ignore it.");
      return null;
    }
    this.nfcTagInfo = nfcTagInfo;
    Logger.info(TAG,'NfcManagerModule====> nfcTagInfo ==');
    if(this.techRequest != null) {
      if(!this.techRequest.isConnected()) {
        let result:boolean = this.techRequest.onConnect(nfcTagInfo);
        if(result) {
          this.techRequest.invokePendingCallback(this.techRequest.getTechType());
        } else {
          this.techRequest.invokePendingCallback(null);
        }
        Logger.info(TAG,'NfcManagerModule====> techRequest ==' );
      }
      return null;
    }
    let parsed:TM.NfcManager.TagEvent = {};
    if(nfcTagInfo.technology.includes(tag.NDEF)) {
      try {
        let ndef:tag.NdefTag  = tag.getNdef(nfcTagInfo);
        parsed = Util.ndefToTagEvent(ndef,nfcTagInfo);
      } catch (error) {
        Logger.info(TAG,'getTag ===> ' + JSON.stringify(error))
      }
    } else {
      parsed = Util.tagToTagEvent(nfcTagInfo)
    }

    return parsed;
  }
}

