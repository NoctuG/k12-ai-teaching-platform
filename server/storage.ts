import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function getS3Client() {
  if (!ENV.s3Bucket) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }
  if (!ENV.awsAccessKeyId || !ENV.awsSecretAccessKey) {
    throw new Error("AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are not configured");
  }

  return new S3Client({
    region: ENV.s3Region,
    endpoint: ENV.s3Endpoint || undefined,
    credentials: {
      accessKeyId: ENV.awsAccessKeyId,
      secretAccessKey: ENV.awsSecretAccessKey,
    },
    forcePathStyle: ENV.s3ForcePathStyle,
  });
}

function buildObjectUrl(key: string): string {
  if (ENV.s3PublicBaseUrl) {
    return `${ENV.s3PublicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  if (ENV.s3Endpoint) {
    return `${ENV.s3Endpoint.replace(/\/+$/, "")}/${ENV.s3Bucket}/${key}`;
  }

  return `https://${ENV.s3Bucket}.s3.${ENV.s3Region}.amazonaws.com/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );

  return { key, url: buildObjectUrl(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: ENV.s3Bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn: 3600 });
  return { key, url };
}
