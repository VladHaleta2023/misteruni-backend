import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  PutObjectCommandInput,
  ListObjectsV2CommandInput,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { File } from '../file.type';

@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_BUCKET')!;
    this.region = this.configService.get<string>('AWS_REGION')!;
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
  }

  async uploadFile(
    file: File,
    key?: string,
  ): Promise<string> {
    if (!this.bucketName) throw new Error('Bucket name is not configured');

    if (!file.mimetype.startsWith('image/')) {
      throw new HttpException(
        `Invalid file type. Only images are allowed.`,
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const fileKey = key ?? file.originalname;

    const commandInput: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(commandInput);

    await this.s3.send(command);

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURIComponent(fileKey)}`;
  }

  async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    if (!this.bucketName) throw new Error('Bucket name is not configured');

    if (!contentType.startsWith('image/')) {
      throw new HttpException(
        `Invalid content type. Only images are allowed.`,
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const commandInput: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    };

    const command = new PutObjectCommand(commandInput);

    await this.s3.send(command);

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}`;
  }

  async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return this.s3.send(command);
  }

  async getAllFileUrls(prefix?: string): Promise<string[]> {
    try {
      const urls: string[] = [];
      let continuationToken: string | undefined;

      do {
        const params: ListObjectsV2CommandInput = {
          Bucket: this.bucketName,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        };

        const command = new ListObjectsV2Command(params);
        const response: ListObjectsV2CommandOutput = await this.s3.send(command);

        if (response.Contents && response.Contents.length > 0) {
          for (const object of response.Contents) {
            if (object.Key) {
              const encodedKey = encodeURIComponent(object.Key).replace(/%2F/g, '/');
              const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodedKey}`;
              urls.push(url);
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return urls;

    } catch (error) {
      throw new HttpException(
        `Błąd Pobierania Wszystkich plików S3: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}