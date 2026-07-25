"""S3: URL firmati per l'upload diretto e per la lettura.

Il bucket non è mai pubblico. L'app carica con una PUT firmata e legge con GET
firmate a vita breve: la foto dell'armadio di qualcuno non deve poter finire in
un indice di ricerca.
"""

from __future__ import annotations

import boto3

from domain.errors import ErroreDominio
from domain.models import UploadFirmato


class ArchivioS3:
    def __init__(self, bucket: str, regione: str | None = None) -> None:
        self._bucket = bucket
        self._s3 = boto3.client("s3", region_name=regione)

    def url_upload(self, chiave: str, content_type: str, scade_in_s: int = 900) -> UploadFirmato:
        url = self._s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": chiave, "ContentType": content_type},
            ExpiresIn=scade_in_s,
        )
        return UploadFirmato(
            chiave=chiave,
            url=url,
            metodo="PUT",
            # Il Content-Type è firmato: se l'app manda un altro tipo, S3
            # rifiuta. È il motivo per cui lo restituiamo esplicitamente.
            intestazioni={"content-type": content_type},
            scade_in_s=scade_in_s,
        )

    def url_lettura(self, chiave: str, scade_in_s: int = 3600) -> str:
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": chiave},
            ExpiresIn=scade_in_s,
        )

    def leggi(self, chiave: str) -> tuple[bytes, str]:
        try:
            oggetto = self._s3.get_object(Bucket=self._bucket, Key=chiave)
        except Exception as exc:
            raise ErroreDominio(f"foto {chiave} illeggibile: {exc}") from exc
        return oggetto["Body"].read(), oggetto.get("ContentType", "image/jpeg")
