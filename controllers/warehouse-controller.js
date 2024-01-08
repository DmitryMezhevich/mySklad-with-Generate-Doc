const axios = require('axios');
const logger = require('../logger');
const OrderModel = require('../models/orderModel');
const warehoseHalper = require('../helpers/warehouse-helpers');
const formidable = require('formidable');
const writerFiles = require('../helpers/writerFiles-helper');

class WarehoseController {
    // REGISTRATION NEW ORDER
    async registratonCounterparty(req, res, next) {
        try {
            const { user_name: userName, user_phone: userPhone } = req.body;

            res.status(200).send('Ok');

            const headers = {
                Authorization: `Bearer ${process.env.MY_SKLAD_TOKEN}`,
                'Accept-Encoding': 'gzip',
                'Content-Type': 'application/json',
            };

            const data = {
                name: userName,
                companyType: 'individual',
                phone: userPhone,
            };

            const response = await axios.post(
                process.env.MY_SKLAD_URL_COUNTERPARTY,
                data,
                { headers }
            );

            req.hrefCounterparty = response.data.meta.href;

            next();
        } catch (error) {
            const { user_name: userName } = req.body;
            logger.error(
                error,
                `Ошибка при создании контрагента Мойсклад! Имя клиента: ${userName}`
            );
            next();
        }
    }

    async registratonCustomerorder(req, res, next) {
        try {
            const headers = {
                Authorization: `Bearer ${process.env.MY_SKLAD_TOKEN}`,
                'Accept-Encoding': 'gzip',
                'Content-Type': 'application/json',
            };

            const data = {
                organization: {
                    meta: {
                        href: process.env.MY_SKLAD_ORGANIZATION,
                        type: 'organization',
                        mediaType: 'application/json',
                    },
                },
                agent: {
                    meta: {
                        href: req.hrefCounterparty,
                        type: 'counterparty',
                        mediaType: 'application/json',
                    },
                },
            };

            const response = await axios.post(
                process.env.MY_SKLAD_URL_CUSTOMERORDER,
                data,
                { headers }
            );

            req.hrefPosition = `${response.data.meta.href}/positions`;

            next();
        } catch (error) {
            const { user_name: userName } = req.body;
            logger.error(
                error,
                `Ошибка при создании нового покупателя Мойсклад! Имя клиента: ${userName}`
            );
            next();
        }
    }

    async addProduct(req, res, next) {
        try {
            const { id_product: idProduct, price } = req.body;

            const headers = {
                Authorization: `Bearer ${process.env.MY_SKLAD_TOKEN}`,
                'Accept-Encoding': 'gzip',
                'Content-Type': 'application/json',
            };

            const data = {
                quantity: 1,
                price: price,
                discount: 0,
                vat: 0,
                assortment: {
                    meta: {
                        href: `https://api.moysklad.ru/api/remap/1.2/entity/product/${idProduct}`,
                        type: 'product',
                        mediaType: 'application/json',
                    },
                },
                reserve: 0,
            };

            const response = await axios.post(req.hrefPosition, data, {
                headers,
            });

            next();
        } catch (error) {
            const { user_name: userName } = req.body;
            logger.error(
                error,
                `Ошибка при добавлении позиции у покупателя Мойсклад! Имя клиента: ${userName}`
            );
            next();
        }
    }

    async telegramNotification(req, res, next) {
        try {
            const {
                name_product: nameProduct,
                image_url: imageURL,
                user_name: userName,
                user_phone: userPhone,
                price,
            } = req.body;

            let message = '';
            message += `<b>34,90 Название товара: </b> ${nameProduct}\n`;
            message += `<b>Ссылка на фото: </b> ${imageURL}\n`;
            message += `<b>Имя клиента: </b> ${userName}\n`;
            message += `<b>Телефон: </b> ${userPhone}\n`;
            message += `<b>Цена: </b> ${price / 100.0} руб.\n`;

            await axios.post(process.env.TELEGRAM_URI_API, {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                parse_mode: 'html',
                text: message,
            });

            next();
        } catch (error) {
            const { user_name: userName } = req.body;
            logger.error(
                error,
                `Ошибка при отправке сообщения в телеграм! Имя клиента: ${userName}`
            );
            next();
        }
    }

    // Загрузка исходной таблицы
    async downloadFile(req, res, next) {
        try {
            const optionsFormidable = {
                uploadDir: `${__dirname}/../buffer`,
                keepExtensions: true,
                maxFileSize: 10 * 1024 * 1024,
                multiples: false,
            };

            const nameFolder = await warehoseHalper.createFolder();
            req.nameFolder = nameFolder;

            const form = formidable(optionsFormidable);

            form.parse(req, (err, _, files) => {
                req.nameBufferFile = files.table.newFilename;
                writerFiles.write(err, files, nameFolder);
                next();
            });
        } catch (error) {
            logger.error(error, `Ошибка во время загрузки файла xlsx`);
            await warehoseHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(`Ошибка во время загрузки файла xlsx`);
        }
    }

    // Перобразование файла xlsx в JSON
    async convertXLSXtoJSON(req, res, next) {
        try {
            const jsonData = await warehoseHalper.xlsxToJSON(req.nameFolder);

            const orderModels = jsonData.map((value) => {
                return new OrderModel(value);
            });

            req.orderModels = orderModels;

            next();
        } catch (error) {
            logger.error(
                error,
                `Ошибка во время перобразование файла xlsx в JSON`
            );
            await warehoseHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(
                `Ошибка во время перобразование файла xlsx в JSON`
            );
        }
    }

    // Генерирование штрихкодов
    async generateBarcode(req, res, next) {
        try {
            const orderModels = req.orderModels;

            const tempOrderModels = await Promise.all(
                orderModels.map(async (value) => {
                    value.post.barcode.fullCode =
                        warehoseHalper.generateFullBarcode(
                            value.post.barcode.incompleteCode
                        );
                    value.post.barcode.svg =
                        await warehoseHalper.generateBarcode(
                            value.post.barcode.fullCode
                        );
                    return value;
                })
            );

            req.orderModels = orderModels;

            // Преобразуем json для формирования разных ярлыков и списков для почты
            req.orderModelsForPost =
                warehoseHalper.conversionJSONForPost(orderModels);

            next();
        } catch (error) {
            logger.error(error, `Ошибка во время генерировании штрихкодов`);
            await warehoseHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(`Ошибка во время генерировании штрихкодов`);
        }
    }

    // Создание xlsx файла с генерироваными трек-номерами
    async generateBarcodeSpin(req, res, next) {
        try {
            await warehoseHalper.createBarcodeSpin(
                req.orderModels,
                req.nameFolder
            );

            next();
        } catch (error) {
            logger.error(
                error,
                `Ошибка во время генерировании обратных штрихкодов`
            );
            await warehoseHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(
                `Ошибка во время генерировании обратных штрихкодов`
            );
        }
    }

    // Генерация ярлыков
    async generateLabels(req, res, next) {
        try {
            const nameFolder = req.nameFolder;
            const models = req.orderModelsForPost;

            req.nameFolder = nameFolder;

            await warehoseHalper.createLabels(nameFolder, models);

            next();

            //res.download(`${__dirname}/../source/lables.pdf`, 'lables.pdf');
        } catch (error) {
            logger.error(error, `Ошибка во время генерация ярлыков`);
            await warehoseHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(`Ошибка во время генерация ярлыков`);
        }
    }

    // Генерация гарантий
    async generateWarranty(req, res, next) {
        try {
            const warrantyModels = await warehoseHalper.createWarranty(
                req.orderModelsForPost,
                req.nameFolder
            );

            next();

            // res.download(
            //     `${__dirname}/../source/warrantyCard.pdf`,
            //     'warrantyCard.pdf'
            // );
        } catch (error) {
            console.log(error);
            logger.error(error, `Ошибка во время генерация гарантий`);
            await warehoseHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(`Ошибка во время генерация гарантий`);
        }
    }

    // Генерация электронных списков для почты
    async generateMailList(req, res, next) {
        try {
            await warehoseHalper.createMailList(
                req.orderModelsForPost,
                req.nameFolder
            );

            next();

            // res.download(
            //     `${__dirname}/../source/mailList.xlsx`,
            //     'mailList.xlsx'
            // );
        } catch (error) {
            logger.error(
                error,
                `Ошибка во время генерация электронных списков для почты`
            );
            await warehoseHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(
                `Ошибка во время генерация электронных списков для почты`
            );
        }
    }

    // Собираем все нужные файлы в zip и отдаем на клиент
    async uploadFile(req, res, next) {
        try {
            const nameFolder = req.nameFolder;
            await warehoseHalper.createZIP(nameFolder);

            res.download(
                `${__dirname}/../tempFiles/${nameFolder}/result.zip`,
                'result.zip',
                (_) => {
                    warehoseHalper.removeFolder(nameFolder);
                }
            );
        } catch (error) {
            logger.error(
                error,
                `Ошибка во время сбора файлов в архив и отправки на клиент`
            );
            await warehoseHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(
                `Ошибка во время сбора файлов в архив и отправки на клиент`
            );
        }
    }
}

module.exports = new WarehoseController();
