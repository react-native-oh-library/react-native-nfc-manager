/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import { tag } from '@kit.ConnectivityKit';
import { TM } from '@rnoh/react-native-openharmony/generated/ts';

const TAG: string = '[Util====>]';
import Logger from './Logger';
export default  class Util {

  static tagToTagEvent(nfcTagInfo: tag.TagInfo):TM.NfcManager.TagEvent {
    let tagEvent:TM.NfcManager.TagEvent = {}
    if(nfcTagInfo!== null) {
      tagEvent.id = this.bytesToHex(nfcTagInfo.uid);
      tagEvent.techTypes = this.technologyToTechTypes(nfcTagInfo.technology);
      return tagEvent;
    }
    return null;
  }

  static ndefToTagEvent(ndef:tag.NdefTag,nfcTagInfo:tag.TagInfo) {
    let tagEvent:TM.NfcManager.TagEvent = {}
    try {
      if(nfcTagInfo!== null) {
        tagEvent.id = Util.bytesToHex(nfcTagInfo.uid);
        tagEvent.techTypes = Util.technologyToTechTypes(nfcTagInfo.technology);
      }
      tagEvent.type = this.translateType(ndef.getNdefTagType());
      tagEvent.maxSize = ndef.getMaxTransmitSize();
      tagEvent.isWritable = ndef.isNdefWritable();
      tagEvent.ndefMessage = this.messageToNdefRecord(ndef.getNdefMessage());
      tagEvent.canMakeReadOnly = ndef.canSetReadOnly();
    } catch (error) {
      Logger.error(TAG,"Failed to convert ndef into TagEvent: "+ error);
    }
    return tagEvent;
  }

  static messageToNdefRecord(ndefMessage:tag.NdefMessage) {
    if(ndefMessage === null || ndefMessage === undefined) {
      return [];
    }
    let ndefRecordList:TM.NfcManager.NdefRecord[] = [];
    ndefMessage.getNdefRecords().forEach(ndefRecord => {
      ndefRecordList.push(this.recordToObject(ndefRecord));
    })
    return ndefRecordList;
  }

  static recordToObject(ndefRecord:tag.NdefRecord) {
    let ndefRecordObj :TM.NfcManager.NdefRecord= {}
    ndefRecordObj.id = ndefRecord.id;
    ndefRecordObj.tnf = ndefRecord.tnf;
    ndefRecordObj.type = ndefRecord.rtdType;
    ndefRecord.payload = ndefRecord.payload;
    return ndefRecordObj;
  }


  static translateType(type:number):string {
    let translation = '';
    switch (type) {
      case tag.NfcForumType.NFC_FORUM_TYPE_1:
        translation = "NFC Forum Type 1";
        break;
      case tag.NfcForumType.NFC_FORUM_TYPE_2:
        translation = "NFC Forum Type 2";
        break;
      case tag.NfcForumType.NFC_FORUM_TYPE_3:
        translation = "NFC Forum Type 3";
        break;
      case tag.NfcForumType.NFC_FORUM_TYPE_4:
        translation = "NFC Forum Type 4";
        break;
      default :
        translation = type.toString();
        break
    }
    return translation;
  }

  /**
   * byte数组转16进制
   * @param bytes
   * @returns {string}
   */
  static bytesToHex(bytes) {
    let hex = [];
    for (let i = 0; i < bytes.length; i++) {
      hex.push((bytes[i] >>> 4).toString(16));
      hex.push((bytes[i] & 0xF).toString(16));
    }
    return hex.join("");
  }

  static technologyToTechTypes(technology:number[]) {
    let techTypes:string[] = [];
    for (let i = 0; i < technology.length; i++) {
      let value = technology[i];
      switch (value) {
        case tag.NFC_A:
          techTypes.push(TM.NfcManager.NfcTech.NfcA);
          break;
        case tag.NFC_B:
          techTypes.push(TM.NfcManager.NfcTech.NfcB);
          break;
        case tag.ISO_DEP:
          techTypes.push(TM.NfcManager.NfcTech.IsoDep);
          break;
        case tag.NFC_F:
          techTypes.push(TM.NfcManager.NfcTech.NfcF);
          break;
        case tag.NFC_V:
          techTypes.push(TM.NfcManager.NfcTech.NfcV);
          break;
        case tag.NDEF:
          techTypes.push(TM.NfcManager.NfcTech.Ndef);
          break;
        case tag.NDEF_FORMATABLE:
          techTypes.push(TM.NfcManager.NfcTech.NdefFormatable);
          break;
        case tag.MIFARE_CLASSIC:
          techTypes.push(TM.NfcManager.NfcTech.MifareClassic);
          break;
        case tag.MIFARE_ULTRALIGHT:
          techTypes.push(TM.NfcManager.NfcTech.MifareUltralight);
          break;
      }
    }
    return techTypes;
  }
}
