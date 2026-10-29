'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('matefxDesktop',Object.freeze({
  openDataset:()=>ipcRenderer.invoke('dataset:open'),
  exportDataset:(dataset)=>ipcRenderer.invoke('dataset:export',dataset),
  version:'4.1.0'
}));
