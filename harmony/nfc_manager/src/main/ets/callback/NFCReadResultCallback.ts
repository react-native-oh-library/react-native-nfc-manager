/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

export type NFCReadResultCallback<T = string, E = void>  = (err?:E, data?: T) => void;