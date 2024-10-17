const fs = require('fs');
const path = require('path');

const encoding = 'utf-8'
const jsonIndent = 4
const contractsPath = path.join(__dirname, 'contracts')
const artifactsPath = path.join(__dirname, 'artifacts');
const buildInfoPath = path.join(artifactsPath, 'build-info');

const contractsFiles = fs.readdirSync(contractsPath).filter(file => file.endsWith('.sol'))
const buildInfoJsonPath = path.join(buildInfoPath, fs.readdirSync(buildInfoPath).filter(file => file.endsWith('.json'))[0]);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, encoding));
}

function writeJson(data, filePath) {
    fs.writeFileSync(`${filePath}_verification.json`, JSON.stringify(data, null, jsonIndent), encoding);
}

function getSources() {
    return readJson(buildInfoJsonPath).input.sources;
}

function getContracts() {
    return readJson(buildInfoJsonPath).output.contracts;
}

function createVerificationFiles() {
    const sources = getSources();
    const contracts = getContracts();
    
    Object.keys(contracts).forEach((key) => {
        const contractName = Object.keys(contracts[key])[0];
        
        if (contractsFiles.includes(`${contractName}.sol`)) {
            const metadata = JSON.parse(contracts[key][contractName].metadata);

            Object.keys(metadata.sources).forEach((contractPath) => {
                const contents = metadata.sources[contractPath];
                delete contents.urls;
                contents.content = sources[contractPath].content;
            });

            writeJson(metadata, path.join(artifactsPath, 'contracts', `${contractName}.sol`, contractName));
        }
    });
}

createVerificationFiles();
