#!/bin/bash

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

nvm use

npm run start:worker:remote
