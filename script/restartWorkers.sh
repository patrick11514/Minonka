#!/bin/bash
WORKER_COUNT=3
for i in $(seq 1 $WORKER_COUNT) ; do
    sudo systemctl restart minonka_worker@${i}.service
done
