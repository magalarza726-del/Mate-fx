'use strict';
const {app, BrowserWindow, ipcMain, dialog, shell, Menu} = require('electron');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {parseDataset} = require('./data-service.cjs');

const assetRoot = path.resolve(__dirname, '..', 'assets');
const mime = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json', '.woff2':'font/woff2'};
let server;

async function localServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      try {
        const uri = new URL(req.url, 'http://localhost');
        const requested = decodeURIComponent(uri.pathname).replace(/^\/+/, '') || 'index.html';
        const destination = path.resolve(assetRoot, requested);
        if (!destination.startsWith(assetRoot + path.sep) || !/\.(html|js|mjs|css|svg|png|json|woff2)$/.test(destination)) {
          res.writeHead(403);res.end('Forbidden');return;
        }
        const data = await fs.readFile(destination);
        res.writeHead(200, {'Content-Type': `${mime[path.extname(destination)] || 'application/octet-stream'}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control':'no-cache'});
        res.end(data);
      } catch (e) { res.writeHead(404);res.end('Not found'); }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}/index.html`));
  });
}

async function start() {
  const home = await localServer();
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 950, minHeight: 620,
    backgroundColor: '#0b1930', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false
    }
  });
  win.webContents.setWindowOpenHandler(({url}) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return {action:'deny'};
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(home.slice(0,home.indexOf('/index.html')) + '/')) {
      event.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url);
    }
  });
  await win.loadURL(home);
  if (process.argv.includes('--dev')) win.webContents.openDevTools({mode:'detach'});
}

ipcMain.handle('dataset:open', async (event) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  const {canceled,filePaths} = await dialog.showOpenDialog(parent, {
    title:'Importar datos de investigación',properties:['openFile'],
    filters:[{name:'Datos',extensions:['csv','xlsx']}, {name:'CSV',extensions:['csv']}, {name:'Excel',extensions:['xlsx']}]
  });
  if (canceled || !filePaths?.length) return null;
  const filePath=filePaths[0];
  const stat=await fs.stat(filePath);
  if(stat.size>20*1024*1024)throw new Error('El archivo supera el límite de 20 MB.');
  const content=await fs.readFile(filePath);
  return parseDataset(filePath, content);
});

ipcMain.handle('dataset:export', async (event, dataset) => {
  if (!dataset || !Array.isArray(dataset.rows) || !Array.isArray(dataset.headers)) throw new Error('Datos no válidos');
  const parent=BrowserWindow.fromWebContents(event.sender);
  const {canceled,filePath}=await dialog.showSaveDialog(parent, {
    title:'Exportar conjunto de datos',defaultPath:'investigacion-datos.json',
    filters:[{name:'JSON', extensions:['json']}]
  });
  if(canceled || !filePath)return false;
  await fs.writeFile(filePath, JSON.stringify(dataset,null,2),'utf8');
  return true;
});

app.whenReady().then(start).catch(error=>{console.error(error);app.quit()});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
app.on('before-quit',()=>{server?.close()});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)start()});
