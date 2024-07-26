import { ArrayList } from '@kit.ArkTS';
import { NFCReadResultCallback } from '../callback/NFCReadResultCallback';
import tag from '@ohos.nfc.tag';
import Logger from '../utils/Logger';
import { TM } from '@rnoh/react-native-openharmony/generated/ts';
const TAG: string = '[TagTechnologyRequest]';

export default class TagTechnologyRequest {
  private mTechTypes:TM.NfcManager.NfcTech[];
  private mJsCallback:NFCReadResultCallback<TM.NfcManager.NfcTech | null,string>;
  private mTechType:TM.NfcManager.NfcTech | null = null;
  private nfcTagInfo: tag.TagInfo | null = null;
  private tagSession:tag.TagSession | null = null;

  constructor(mTechTypes:TM.NfcManager.NfcTech[]) {
    this.mTechTypes = mTechTypes;
  }

  setNFCReadResultListener(mJsCallback:NFCReadResultCallback<TM.NfcManager.NfcTech | null,string>){
    this.mJsCallback = mJsCallback;
  }

  invokePendingCallbackWithError(err:string){
    if(this.mJsCallback !== null) {
      this.mJsCallback(err)
      this.mJsCallback = null;
    }
  }

  getTechType() {
    return this.mTechType;
  }

  isConnected() {
    return this.tagSession !== null;
  }

  nfcConnectToTag() {
    let connectStatus = false;
    if(this.tagSession != undefined && !this.tagSession?.isConnected()){
      try {
        this.tagSession.connect();
        let maxSendLength: number = this.tagSession?.getMaxTransmitSize() as number;
        Logger.info(TAG,"getTagInfo>>>maxSendLength:" + maxSendLength);
        Logger.info(TAG,"tag connect success");
        connectStatus = true;
      } catch (error) {
        Logger.info(TAG,"tag connect busiError: " + error)
      }
    }
    return connectStatus;
  }

  invokePendingCallback(connectedTech:TM.NfcManager.NfcTech | null){
    if(this.mJsCallback !== null) {
      this.mJsCallback(null,connectedTech)
      this.mJsCallback = null;
    }
  }

  getTechHandle():tag.TagSession{
    return this.tagSession;
  }

  getTagHandle() {
    return this.nfcTagInfo;
  }

  onConnect(tagInfo: tag.TagInfo) {
    if(tagInfo === null || tagInfo === undefined) {
      Logger.info(TAG,"no TagInfo to be created, ignore it.")
      return false;
    }
    this.nfcTagInfo = tagInfo;
    for (let i = 0; i < this.mTechTypes.length; i++) {
      let techType = this.mTechTypes[i] as string;
      let techTypeTag = null;
      switch (techType) {
        case "Ndef":
          try {
            let ndef:tag.NdefTag  = tag.getNdef(tagInfo);
            this.tagSession = ndef;
            techTypeTag = TM.NfcManager.NfcTech.Ndef
          } catch (error) {
            Logger.error(TAG, "tag getNdef busiError: " + error);
          }
          break;
        case "NfcA":
          try {
            let nfcA:tag.NfcATag = tag.getNfcA(tagInfo);
            this.tagSession = nfcA;
            techTypeTag = TM.NfcManager.NfcTech.NfcA
          } catch (error) {
            Logger.error(TAG, "tag getNfcA busiError: " + error);
          }
          break;
        case "NfcB":
          try {
            let nfcB:tag.NfcBTag = tag.getNfcB(tagInfo);
            this.tagSession = nfcB;
            techTypeTag = TM.NfcManager.NfcTech.NfcB
          } catch (error) {
            Logger.error(TAG, "tag getNfcB busiError: " + error);
          }
          break;
        case "NfcF":
          try {
            let nfcF:tag.NfcFTag = tag.getNfcF(tagInfo);
            this.tagSession = nfcF;
            techTypeTag = TM.NfcManager.NfcTech.NfcF
          } catch (error) {
            Logger.error(TAG, "tag getNfcF busiError: " + error);
          }
          break;
        case "NfcV":
          try {
            let nfcV: tag.NfcVTag = tag.getNfcV(tagInfo);
            this.tagSession = nfcV;
            techTypeTag = TM.NfcManager.NfcTech.NfcV
          } catch (error) {
            Logger.error(TAG, "tag getNfcF busiError: " + error);
          }
          break;
        case "IsoDep":
          try {
            let isoDep: tag.IsoDepTag = tag.getIsoDep(tagInfo);
            this.tagSession = isoDep;
            techTypeTag = TM.NfcManager.NfcTech.IsoDep
          } catch (error) {
            Logger.error(TAG, "tag getIsoDep busiError: " + error);
          }
          break;
        case "MifareClassic":
          try {
            let mifareClassic: tag.MifareClassicTag = tag.getMifareClassic(tagInfo);
            this.tagSession = mifareClassic;
            techTypeTag = TM.NfcManager.NfcTech.MifareClassic
          } catch (error) {
            Logger.error(TAG, "tag getMifareClassic busiError: " + error);
          }
          break;
        case "MifareUltralight":
          try {
            let mifareUltralightTag: tag.MifareUltralightTag = tag.getMifareUltralight(tagInfo);
            this.tagSession = mifareUltralightTag;
            techTypeTag = TM.NfcManager.NfcTech.MifareUltralight
          } catch (error) {
            Logger.error(TAG, "tag getMifareClassic busiError: " + error);
          }
          break;
        case "NdefFormatable":
          try {
            let ndefFormatable: tag.NdefFormatableTag = tag.getNdefFormatable(tagInfo);
            this.tagSession = ndefFormatable;
            techTypeTag = TM.NfcManager.NfcTech.NdefFormatable
          } catch (error) {
            Logger.error(TAG, "tag getMifareClassic busiError: " + error);
          }
          break;
      }
      if(this.tagSession === null) {
        continue;
      }
      try {
        Logger.info(TAG,"connect to " + techType)
        this.tagSession.connect();
        this.mTechType = techTypeTag;
        return true;
      } catch (error) {
        Logger.info(TAG,"fail to connect tech")
      }
    }
    //没有链接
    this.tagSession = null;
    this.mTechType = null;
    return false;
  }

  close() {
    this.tagSession = null;
  }
}