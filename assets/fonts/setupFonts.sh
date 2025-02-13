#!/bin/bash
#if folder .fonts in ~ doesn't exist, create it
if [ ! -d ~/.local/share/fonts ]; then
    mkdir -p ~/.local/share/fonts
fi

#copy all fonts to ~/.fonts
cp -r ./fonts/* ~/.local/share/fonts