const fs = require("fs"),
      path = require("path"),
      under = "built/src",
      prefixes = ["var __decorate =", "var __assign ="];

// tell istanbul to ignore TS-generated decorator code 

fs.readdirSync(under).forEach(file => {
    file = path.join(under, file);
    let src = fs.readFileSync(file, "utf8");
    prefixes.forEach(prefix => {
        src = src.replace(prefix, "/* istanbul ignore next */\n" + prefix);
    });    
    fs.writeFileSync(file, src);
});
