const fs = require('fs');
const warehoseHalper = require('../helpers/warehouse-helpers');

class WreterFiles {
    _rename(listFiles, nameFolder) {
        Object.entries(listFiles).forEach(([_, value]) => {
            fs.renameSync(
                value.filepath,
                `${__dirname}/../tempFiles/${nameFolder}/` + 'table.xlsx'
            );
        });
    }

    _removeBuffer(listFiles) {
        Object.entries(listFiles).forEach(([_, value]) => {
            fs.unlinkSync(value.filepath);
        });
    }

    write(err, listFiles, nameFolder) {
        if (err) {
            this._removeBuffer(listFiles);
            throw new Error();
        }

        this._rename(listFiles, nameFolder);
    }
}

module.exports = new WreterFiles();
