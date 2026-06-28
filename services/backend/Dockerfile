FROM python:3.11-slim

# Avoid .pyc files, unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install deps first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application
COPY app ./app

# Render/Cloud Run provide $PORT; default to 8000 locally
ENV PORT=8000
EXPOSE 8000

# Bind to the platform-provided port
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
