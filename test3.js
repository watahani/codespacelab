// https://dirask.com/posts/JavaScript-read-image-from-clipboard-as-Data-URLs-encoded-with-Base64-10Wwaj
var clipboardUtils = new function() {
    var permissions = {
        'image/bmp': true,
        'image/gif': true,
        'image/png': true,
        'image/jpeg': true,
        'image/tiff': true
    };
 
    function getType(types) {
        for (var j = 0; j < types.length; ++j) {
            var type = types[j];
            if (permissions[type]) {
                return type;
            }
        }
        return null;
    }
    function getItem(items) {
        for (var i = 0; i < items.length; ++i) {
            var item = items[i];
            if(item) {
                var type = getType(item.types);
                if(type) {
                    return item.getType(type);
                }
            }
        }
        return null;
    }
    function loadFile(file, callback) {
        if (window.FileReader) {
            var reader = new FileReader();
            reader.onload = function() {
                callback(reader.result, null);
            };
            reader.onerror = function() {
                callback(null, 'Incorrect file.');
            };
            reader.readAsDataURL(file);
        } else {
            callback(null, 'File api is not supported.');
        }
    }

    this.readImage = function(callback) {
        if (navigator.clipboard) {
            var promise = navigator.clipboard.read();
            promise
                .then(function(items) {
                    var promise = getItem(items);
                    if (promise == null) {
                        callback(null, null);
                          return;
                    }
                    promise
                          .then(function(result) {
                              loadFile(result, callback);
                        })
                          .catch(function(error) {
                              callback(null, 'Reading clipboard error.');
                        });
                })
                .catch(function(error) {
                    callback(null, 'Reading clipboard error.');
                });
        } else {
            callback(null, 'Clipboard is not supported.');
        }
    };
};