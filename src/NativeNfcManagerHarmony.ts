import { TurboModuleRegistry, RootTag } from 'react-native';
import type { TurboModule } from 'react-native/Libraries/TurboModule/RCTExport';

export interface RegisterTagEventOpts {
   alertMessage?: string;
   invalidateAfterFirstRead?: boolean;
   isReaderModeEnabled?: boolean;
   readerModeFlags?: number;
   readerModeDelay?: number;
 }

type TNF = 0x0 | 0x01 | 0x02 | 0x03 | 0x04 | 0x05 | 0x06 | 0x07;

export interface NdefRecord {
  id?: number[];
  tnf?: TNF;
  type?: number[] | string;
  payload?: number[];
}

export interface TagEvent {
  ndefMessage?: NdefRecord[];
  maxSize?: number;
  isWritable?:boolean;
  type?: string;
  techTypes?: string[];
  canMakeReadOnly?:boolean;
  id?: string;
}

 export type NFCReadResultCallback = (err:string, result: string) => void;

 export enum NfcTech {
   Ndef = 'Ndef',
   NfcA = 'NfcA',
   NfcB = 'NfcB',
   NfcF = 'NfcF',
   NfcV = 'NfcV',
   IsoDep = 'IsoDep',
   MifareClassic = 'MifareClassic',
   MifareUltralight = 'MifareUltralight',
   MifareIOS = 'mifare',
   Iso15693IOS = 'iso15693',
   FelicaIOS = 'felica',
   NdefFormatable = 'NdefFormatable',
 }

 export enum NdefStatus {
  NotSupported = 1,
  ReadWrite = 2,
  ReadOnly = 3,
}

export interface Spec extends TurboModule {
   getConstants(): {};
   start(): Promise<void>;
   isSupported(): Promise<boolean>;
   isEnabled(): Promise<boolean>;
   registerTagEvent(options?: RegisterTagEventOpts): Promise<void>;
   unregisterTagEvent(): Promise<void>;
   requestTechnology(
      tech: NfcTech[]
    ): Promise<NfcTech | null>;
   cancelTechnologyRequest: () => Promise<void>;
   getTag: () => Promise<TagEvent | null>;
   getBackgroundTag: () => Promise<TagEvent | null>;
   clearBackgroundTag: () => Promise<void>;
   hasTagEventRegistration():Promise<boolean>;

  /**
   * common tech handler getters for both iOS / Android
  */
   writeNdefMessage: (bytes: number[] , options?: { reconnectAfterWrite: boolean }) => Promise<void>;
   getNdefMessage: () => Promise<TagEvent | null>;
   makeReadOnly: () => Promise<boolean>;
   getNdefStatus: () => Promise<TagEvent | null>;
   getCachedNdefMessage: () => Promise<TagEvent | null>;

   transceive: (bytes: number[]) => Promise<number[]>;

   goToNfcSetting(): Promise<boolean>;
   getLaunchTagEvent(): Promise<TagEvent | null>;
   getMaxTransceiveLength(): Promise<number>;
   setTimeout(timeout: number): Promise<void>;
   connect: (techs: NfcTech[]) => Promise<void>;
   close: () => Promise<void>;

   mifareClassicSectorToBlock: (sector: number) => Promise<number>;
   mifareClassicReadBlock: ( block:number,) => Promise<number[]>;
   mifareClassicWriteBlock: (block: number,simpliArr: number[],) => Promise<void>;
   mifareClassicIncrementBlock: (block:number, data: number) => Promise<void>;
   mifareClassicDecrementBlock: (block: number,data: number) => Promise<void>;
   mifareClassicTransferBlock: (block: number) => Promise<void>;
   mifareClassicGetSectorCount: () => Promise<number>;
   mifareClassicAuthenticateA: (sector: number,keys: number[]) => Promise<void>;
   mifareClassicAuthenticateB: (sector: number,keys: number[]) => Promise<void>;

   mifareUltralightReadPages: (offset: number) => Promise<number[]>;
   mifareUltralightWritePage: (offset: number,data: number[]) => Promise<void>;

   formatNdef: (bytes: number[], options?: { readOnly: boolean }) => Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('NfcManager')!;
