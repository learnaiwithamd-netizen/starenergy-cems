FROM python:3.12-slim

WORKDIR /app

RUN groupadd --system --gid 1001 cems \
  && useradd --system --uid 1001 --gid cems --no-create-home --shell /usr/sbin/nologin cems

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=cems:cems app ./app

USER cems

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
