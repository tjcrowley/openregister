export type HardwareStatus = 'connected' | 'disconnected' | 'error' | 'busy';

export interface PrintJob {
  content: string;
  copies?: number;
  cutAfter?: boolean;
}

export interface IHardwareDriver {
  readonly driverName: string;
  readonly deviceType: 'printer' | 'cash_drawer' | 'barcode_scanner' | 'card_reader' | 'display';
  getStatus(): Promise<HardwareStatus>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface IPrinterDriver extends IHardwareDriver {
  readonly deviceType: 'printer';
  print(job: PrintJob): Promise<void>;
  checkPaper(): Promise<{ hasLowPaper: boolean; hasPaper: boolean }>;
}

export interface ICashDrawerDriver extends IHardwareDriver {
  readonly deviceType: 'cash_drawer';
  open(): Promise<void>;
  isOpen(): Promise<boolean>;
}

export interface IBarcodeScanner extends IHardwareDriver {
  readonly deviceType: 'barcode_scanner';
  onScan(callback: (barcode: string) => void): () => void;
}
