/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

'use strict';
import {NativeModules, NativeEventEmitter,TurboModuleRegistry} from 'react-native';

import NfcManager from './NativeNfcManagerHarmony';

//const NativeNfcManager = TurboModuleRegistry ? TurboModuleRegistry.get('NfcManager') : NativeModules.NfcManager;

const NativeNfcManager = TurboModuleRegistry ? NfcManager : NativeModules.NfcManager;

const NfcManagerEmitter = new NativeEventEmitter(NativeNfcManager);

function callNative(name, params = []) {
  const nativeMethod = NativeNfcManager[name];

  if (!nativeMethod) {
    throw new Error(`no such native method: "${name}"`);
  }

  if (!Array.isArray(params)) {
    throw new Error('params must be an array');
  }
  const inputParams = [...params];

  return nativeMethod(...inputParams);
}

export {NativeNfcManager, NfcManagerEmitter, callNative};
