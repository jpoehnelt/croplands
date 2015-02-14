var gfsad = {};
gfsad.decToHex = function (n) {
    // return two digit hex number
    if (n > 255) {
        throw "Cannot convert to hex.";
    }
    return (n + 0x100).toString(16).substr(-2).toUpperCase();
};