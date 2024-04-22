const onError = (info) => console.log("[C ERROR]", info);
window.addEventListener("filePluginIsReady", function () {
    window.initPersistentFileSystem();
}, false);
window.CORDOVA = {
    loadVaults: (callback) => {
        window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, (entry) => {
            console.log("Attempting to load raw vaults.json");
            entry.getFile("vaults.json", { create: true }, (fileEntry) => {
                window.CORDOVA?.getFileContent(fileEntry, (data) => {
                    if (data === "") {
                        window.CORDOVA?.writeFileContent(fileEntry, "[]", (isSuccess) => {
                            if (!isSuccess)
                                console.log("Could not fill vaults.json");
                            callback([]);
                        });
                    }
                    else if (data !== null) {
                        console.log("Got data  for vaults.json");
                        callback(JSON.parse(data.toString()));
                    }
                    else {
                        window.CORDOVA?.writeFileContent(fileEntry, "[]", (isSuccess) => {
                            if (!isSuccess)
                                console.log("Could not fill vaults.json");
                            callback([]);
                        });
                    }
                });
            });
        });
    },
    saveVaults: (vaults, callback) => {
        window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, (entry) => {
            entry.getFile("vaults.json", { create: true }, (fileEntry) => {
                window.CORDOVA?.writeFileContent(fileEntry, JSON.stringify(vaults.map((v) => {
                    return { name: v.name, path: v.path, algorithm: v.algorithm };
                })), (s) => {
                    callback(s);
                });
            }, () => {
                callback(false);
            });
        });
    },
    openVault: (info, callback) => {
        window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, (entry) => {
            console.log("Accessing vault storage");
            entry.getFile(info.path + "information.json", { create: true }, (file) => {
                console.log("Reading information.json");
                window.CORDOVA?.getFileContent(file, (contentRaw) => {
                    if (contentRaw) {
                        try {
                            console.log("Decrypt file");
                            let data = CryptoJS.AES.decrypt(contentRaw + "", info.password);
                            console.log(JSON.parse(data.toString(CryptoJS.enc.Utf8)));
                            callback(JSON.parse(data.toString(CryptoJS.enc.Utf8)));
                        }
                        catch (e) {
                            console.log(e);
                            callback(null);
                        }
                    }
                });
            });
        }, onError);
    },
    createVault: (info, callback) => {
        window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, (entry) => {
            const directoryLoop = (id_attempt) => {
                entry.getDirectory(`vault${id_attempt}`, {
                    create: true,
                    exclusive: true,
                }, (dir) => {
                    console.log("Created vault folder");
                    info.path = dir.fullPath;
                    const vaultToSend = {
                        info: info,
                        content: [],
                        is_open: false,
                    };
                    dir.getFile("information.json", { create: true }, (file) => {
                        console.log("Created information.json");
                        const data = CryptoJS.AES.encrypt(JSON.stringify(vaultToSend), vaultToSend.info.password);
                        window.CORDOVA?.writeFileContent(file, data.toString(), (state) => {
                            console.log("information.json encrypted data write was a - " + state
                                ? "success"
                                : "failure");
                        });
                    });
                    callback(vaultToSend);
                }, () => {
                    directoryLoop(id_attempt + 1);
                });
            };
            directoryLoop(0);
        }, onError);
    },
    updateVault: (vault, callback) => {
        window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, (entry) => {
            entry.getFile(vault.info.path + "information.json", { create: true }, (file) => {
                console.log("Created information.json");
                const data = CryptoJS.AES.encrypt(JSON.stringify(vault), vault.info.password);
                window.CORDOVA?.writeFileContent(file, data.toString(), callback);
            });
        }, onError);
    },
    getVaultFolder: (root, name) => {
        if (name.length === 0)
            return {
                path: "",
                raw: "",
                content: root,
            };
        let newContent = root.filter((thing) => thing.encoded_name === name[0]);
        name.shift();
        let result = window.CORDOVA?.getVaultFolder(newContent[0].children, name);
        if (result)
            return {
                path: newContent[0].encoded_name + "/" + result.path,
                raw: newContent[0].name + "/" + result.raw,
                content: result.content,
            };
        console.log("Critical error is getVaultFolder()");
        throw "getVault Failed unexpectedly!";
    },
    getNextFreePath: (content) => {
        for (let x = 0; x < 50000; x++) {
            if (content.filter((item) => item.name === `${x}`).length === 0)
                return `${x}`;
        }
        return null;
    },
    performVaultFileOperation: (encodedLocation, name, vault, action, data, callback) => {
        const here = window.CORDOVA.getVaultFolder(vault.content, [
            ...encodedLocation,
        ]);
        const rawName = here.content.filter((i) => i.encoded_name === name)[0].name;
        window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, (entry) => {
            entry.getFile(vault.info.path + here.raw + rawName, { create: false }, (file) => {
                if (action === "read") {
                    window.CORDOVA?.getFileContent(file, (contentRaw) => {
                        if (contentRaw !== null) {
                            try {
                                let data = CryptoJS.AES.decrypt(contentRaw + "", vault.info.password);
                                callback(data.toString(CryptoJS.enc.Utf8));
                            }
                            catch (e) {
                                callback(false);
                            }
                        }
                        else
                            callback(false);
                    });
                }
                else {
                    const payload = CryptoJS.AES.encrypt(data, vault.info.password);
                    window.CORDOVA.writeFileContent(file, payload.toString(), callback);
                }
            });
        }, onError);
    },
    vaultCreateEntry: (encodedLocation, name, type, vault, callback) => {
        const data = window.CORDOVA.getVaultFolder(vault.content, [
            ...encodedLocation,
        ]);
        window.resolveLocalFileSystemURL(cordova.file.externalDataDirectory, (entry) => {
            let rawName = window.CORDOVA.getNextFreePath(data.content);
            if (rawName === null) {
                callback(false);
                return;
            }
            console.log(vault.info.path + "|" + data.raw + "|" + rawName);
            if (type === "folder") {
                entry.getDirectory(vault.info.path + data.raw + rawName, { create: true }, (status) => {
                    data.content.push({
                        encoded_name: name,
                        name: rawName,
                        is_dir: true,
                        children: [],
                    });
                    window.CORDOVA?.updateVault(vault, callback);
                });
            }
            else if (type === "file") {
                entry.getFile(vault.info.path + data.raw + rawName, { create: true }, (status) => {
                    data.content.push({
                        encoded_name: name,
                        name: rawName,
                        is_dir: false,
                        children: [],
                    });
                    window.CORDOVA?.updateVault(vault, callback);
                });
            }
        }, onError);
    },
    getFileContent: (file, callback) => {
        file.file((blob) => {
            var reader = new FileReader();
            reader.onloadend = function () {
                callback(this.result);
            };
            reader.onerror = (e) => console.log(e);
            reader.readAsText(blob);
        }, onError);
    },
    writeFileContent: (file, content, callback) => {
        file.createWriter((fileWriter) => {
            fileWriter.onwriteend = () => callback(true);
            fileWriter.onerror = (e) => {
                console.log(e);
                callback(false);
            };
            fileWriter.write(content);
        }, onError);
    },
    getFileFromUserNative: (callback) => {
        (async () => {
            const file = await chooser.getFileMetadata();
            if (file) {
                console.log(file);
                callback(file.name);
            }
            else
                callback("canceled");
        })();
    },
};
