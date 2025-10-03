export interface File {
  originalname: string;
  filename: string;
  path?: string;
  size: number;
  mimetype: string;
  fieldname: string;
  buffer?: Buffer;
  [key: string]: any;
}