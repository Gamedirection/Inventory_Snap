from __future__ import annotations

import boto3
from botocore.client import Config

from app.config import settings


def get_minio_client():
    """Return a configured boto3 S3 client pointed at MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=f"{'https' if settings.minio_secure else 'http'}://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def upload_to_minio(bucket: str, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    """Upload raw bytes to a MinIO bucket under the given key."""
    client = get_minio_client()
    import io
    client.upload_fileobj(
        io.BytesIO(data),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )


def get_presigned_url(bucket: str, key: str, expires: int = 3600) -> str:
    """Generate a presigned GET URL for a MinIO object."""
    client = get_minio_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )


def download_from_minio(bucket: str, key: str) -> bytes:
    """Download an object from MinIO and return its raw bytes."""
    client = get_minio_client()
    response = client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()
