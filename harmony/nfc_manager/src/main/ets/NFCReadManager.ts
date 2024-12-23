/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import { Want } from '@kit.AbilityKit';
import Logger from './utils/Logger';

const TAG: string = '[NFCReadManager====>]';
export default class NFCReadManager {

  private static nfcReadManager? : NFCReadManager;
  private backgroundWant:Want|null = null;

  public static getInstance () {
    if (NFCReadManager.nfcReadManager == null) {
      NFCReadManager.nfcReadManager = new NFCReadManager();
    }
    return NFCReadManager.nfcReadManager;
  }

  setLaunchWant(want: Want) {
    Logger.info(TAG,'setLaunchWant  want ===> ' + JSON.stringify(this.backgroundWant));
    this.backgroundWant = want;
  }

  getBackgroundWant():Want{
    return this.backgroundWant;
  }

  close(){
    this.backgroundWant = null;
  }
}