/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import {Platform} from 'react-native';
import Ndef from '../ndef-lib';
import {NfcEvents, NfcTech, NdefStatus} from './NfcManager';
import {NfcAdapter, NfcManagerAndroid} from './NfcManagerAndroid';
import {
  Nfc15693RequestFlagIOS,
  Nfc15693ResponseFlagIOS,
  NfcManagerIOS,
} from './NfcManagerIOS';
import {NfcManagerHarmony} from './NfcManagerHarmony'
import * as NfcError from './NfcError';

const nfcManager = (() => {
  if (Platform.OS === 'ios') {
    return new NfcManagerIOS();
  } if (Platform.OS = 'harmony') {
    return new NfcManagerHarmony();
  }else {
    return new NfcManagerAndroid();
  }
})();

// only for backward-capability
const NfcErrorIOS = NfcError.NfcErrorIOS;

export default nfcManager;

export {
  NfcTech,
  NfcEvents,
  NfcAdapter,
  Nfc15693RequestFlagIOS,
  Nfc15693ResponseFlagIOS,
  Ndef,
  NdefStatus,
  NfcError,
  NfcErrorIOS,
};
