const Router = require('express').Router;
const warehouseController = require('../../controllers/warehouse-controller');

const router = new Router();

router.post(
    '/newOrder',
    warehouseController.registratonCounterparty,
    warehouseController.registratonCustomerorder,
    warehouseController.addProduct,
    warehouseController.telegramNotification
);

router.post(
    '/createShipment',
    warehouseController.downloadFile,
    warehouseController.convertXLSXtoJSON,
    warehouseController.generateBarcode,
    warehouseController.generateLabels,
    warehouseController.generateWarranty,
    warehouseController.generateMailList,
    warehouseController.generateBarcodeSpin,
    warehouseController.uploadFile
);

router.post(
    '/labels',
    warehouseController.downloadFile,
    warehouseController.convertXLSXtoJSON,
    warehouseController.generateBarcode,
    warehouseController.generateLabels
);
router.post(
    '/warranty',
    warehouseController.convertXLSXtoJSON,
    warehouseController.generateWarranty
);
router.post(
    '/mailList',
    warehouseController.downloadFile,
    warehouseController.convertXLSXtoJSON,
    warehouseController.generateBarcode,
    warehouseController.generateMailList
);

module.exports = router;
