from celery import Celery
from app.config import settings

celery_app = Celery(
    "inventory_snap",
    include=[
        "app.workers.tasks.ai_processing",
        "app.workers.tasks.export_generation",
        "app.workers.tasks.thumbnail",
    ],
)
celery_app.config_from_object({
    "broker_url": settings.celery_broker_url,
    "result_backend": settings.celery_result_backend,
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
    "task_track_started": True,
    "task_acks_late": True,
    "worker_prefetch_multiplier": 1,
    "task_routes": {
        "app.workers.tasks.ai_processing.*": {"queue": "ai_processing"},
        "app.workers.tasks.export_generation.*": {"queue": "exports"},
        "app.workers.tasks.*": {"queue": "default"},
    },
})
celery_app.autodiscover_tasks(["app.workers.tasks"])
