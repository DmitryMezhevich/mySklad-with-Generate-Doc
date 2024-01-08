const bwipjs = require('bwip-js');
const ExcelJS = require('exceljs');
const fs = require('fs/promises');
const fss = require('fs');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const WarrantyModel = require('../models/warrantyModel');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const PostMoneyModel = require('../models/postMoneyModel');
const MailList = require('../models/mailList');
const { error } = require('console');

class WarehouseHelper {
    // Генерация и контрольной цифры в штрихкоде
    generateFullBarcode(inputString) {
        // Функция isDigit проверяет, является ли символ числом
        const isDigit = (char) => !isNaN(parseInt(char));

        // Массив коэффициентов для умножения
        const multipliers = [8, 6, 4, 2, 3, 5, 9, 7];

        // Преобразование строки в массив символов, фильтрация только цифр и преобразование их в числа
        const digitsArray = Array.from(inputString).filter(isDigit).map(Number);

        // Умножение каждого числа на соответствующий коэффициент
        const multipliedArray = digitsArray.map(
            (digit, index) => digit * multipliers[index]
        );

        // Вычисление общей суммы элементов массива
        const remains =
            11 - (multipliedArray.reduce((acc, val) => acc + val, 0) % 11);

        // Определение контрольной цифры в соответствии с условиями
        let controlDigit;
        if (remains >= 1 && remains <= 9) {
            controlDigit = remains;
        } else if (remains === 10) {
            controlDigit = 0;
        } else if (remains === 11) {
            controlDigit = 5;
        }

        // Вставка контрольной цифры перед "BY" в строке
        const index = inputString.indexOf('BY');
        const stringWithControlDigit =
            inputString.slice(0, index) +
            controlDigit +
            inputString.slice(index);

        return stringWithControlDigit;
    }

    // Генерация штрихкода в svg
    async generateBarcode(inputString) {
        if (inputString.length === 13) {
            const result = await bwipjs.toSVG({
                bcid: 'code128',
                text: inputString,
                height: 12,
                includetext: true,
                textxalign: 'center',
                textcolor: '000000',
            });

            return result;
        } else {
            return '';
        }
    }

    // Чтение и преобразование xlsx файла в json
    async xlsxToJSON(nameFolder) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(
            `${__dirname}/../tempFiles/${nameFolder}/table.xlsx`
        );

        const worksheet = workbook.worksheets[0];

        const jsonData = [];

        await worksheet.eachRow({ includeEmpty: true }, (row) => {
            const rowObject = {};
            row.eachCell({ includeEmpty: true }, (cell) => {
                rowObject[cell._address.replace(/[^A-Za-z]/g, '')] =
                    cell.value !== null ? cell.value : '';
            });
            jsonData.push(rowObject);
        });

        return jsonData;
    }

    // Преобразование json для формирования ярлыков и списков
    conversionJSONForPost(model) {
        let object = {
            48: [],
            50: [],
            4: [],
        };

        model.forEach((value) => {
            switch (value.post.delivery.type) {
                case 48:
                    object['48'].push(value);
                    break;
                case 50:
                    object['50'].push(value);
                    break;
                case 4:
                    object['4'].push(value);
                default:
                    break;
            }
        });

        return object;
    }

    // Подготовка html страницы
    async generateHTML(model, fileName) {
        const htmlDoc = await fs.readFile(
            `${__dirname}/../source/${fileName}`,
            'utf8'
        );

        Handlebars.registerHelper('ifEven', function (index, options) {
            return index % 2 === 0 ? options.fn(this) : options.inverse(this);
        });

        Handlebars.registerHelper('if_eq', function (conditional, options) {
            if (conditional === 50) {
                return options.fn(this);
            } else {
                return options.inverse(this);
            }
        });

        const template = Handlebars.compile(htmlDoc);
        const result = template({ packages: model });

        return result;
    }

    // Создание гарантий для: Стандартов, Элетов и Почтовый отправлений
    async createWarranty(models, nameFolder) {
        for (const key in models) {
            if (models[key].length !== 0) {
                let nameFile = '';

                switch (key) {
                    case '48':
                        nameFile = 'warrantyStandart';
                        break;
                    case '50':
                        nameFile = 'warrantyElit';
                        break;
                    case '4':
                        nameFile = 'warrantyPackage';
                        break;
                    default:
                        break;
                }

                const warrantyModels = this.conversionJsonForWarrantyCards(
                    models[key]
                );

                const labelsHTML = await this.generateHTML(
                    warrantyModels,
                    `warrantyCard.html`
                );
                await this.htmlToPDF(
                    labelsHTML,
                    nameFolder,
                    `${nameFile}.pdf`,
                    true
                );
            }
        }
    }

    // Преобразование данных JSON для гарантийных талонов
    conversionJsonForWarrantyCards(models) {
        let warrantyModels = [];

        for (let i = 0; i < models.length; i++) {
            if (i + 1 < models.length) {
                warrantyModels.push(
                    new WarrantyModel(models[i], models[i + 1])
                );
                i++;
            } else {
                warrantyModels.push(new WarrantyModel(models[i]));
            }
        }

        return warrantyModels;
    }

    // Создание электронных списков для: Стандартов, Элетов и Почтовый отправлений
    async createMailList(models, nameFolder) {
        for (const key in models) {
            if (models[key].length !== 0) {
                let nameFile = '';

                switch (key) {
                    case '48':
                        nameFile = 'reestr_standart_';
                        break;
                    case '50':
                        nameFile = 'reestr_elit_';
                        break;
                    case '4':
                        nameFile = 'reestr_package_';
                        break;
                    default:
                        break;
                }

                const warrantyModels = this.conversionJsonForMailList(
                    models[key]
                );

                await this.generateMailList(
                    warrantyModels,
                    nameFile,
                    nameFolder,
                    key
                );
            }
        }
    }

    // Преобразование данных JSON для электронных списков
    conversionJsonForMailList(models) {
        const warrantyModels = models.map((value, index) => {
            return new MailList(value, index + 1);
        });

        return warrantyModels;
    }

    // Создаем электронный список для почты csv
    async generateMailList(models, nameFile, nameFolder, code) {
        const nextDay = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
            .toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            })
            .replace(/\//g, '.');
        const tempNameFile = `${nameFile}${nextDay.replace(/\./g, '_')}`;
        // Создаем новую книгу Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(tempNameFile); // Добавляем лист

        const header = {
            a: 491643493,
            b: nextDay,
            c: 1000,
            d: models.length,
            e: code, // 48 - E-commers Standart, 50 - E-commers Elit, 4 - посылки без ОЦ,
            f: 1,
        };

        sheet.addRow(Object.values(header));

        // Добавляем данные из JSON в лист
        await models.forEach((model) => {
            sheet.addRow(Object.values(model.mailList));
        });

        await workbook.xlsx.writeFile(
            `${__dirname}/../tempFiles/${nameFolder}/source/${tempNameFile}.xlsx`,
            {
                encoding: 'utf8',
            }
        );
    }

    // Создаем xlsx с обратными трек-номерами
    async createBarcodeSpin(models, nameFolder) {
        // Создаем новую книгу Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Barcodes'); // Добавляем лист

        // Добавляем данные из JSON в лист
        await models.forEach((model) => {
            sheet.addRow(
                Object.values([
                    model.post.barcode.fullCode,
                    model.client.surname,
                    model.client.phone,
                ])
            );
        });

        await workbook.xlsx.writeFile(
            `${__dirname}/../tempFiles/${nameFolder}/source/BarcodeSpin.xlsx`,
            {
                encoding: 'utf8',
            }
        );
    }

    // Конвертация HTML в PDF
    async htmlToPDF(html, nameOfFolder, nameOfFile, landscape = false) {
        async function generatePDFfromHTML(htmlContent, outputPath) {
            const browser = await puppeteer.launch({ headless: 'new' });
            const page = await browser.newPage();
            await page.setContent(htmlContent);
            await page.pdf({
                path: outputPath,
                format: 'A4',
                landscape: landscape,
            });
            await browser.close();
        }

        // Usage
        await generatePDFfromHTML(
            html,
            `${__dirname}/../tempFiles/${nameOfFolder}/source/${nameOfFile}`
        );

        return;
    }

    // Создаем zip файл со всеми файлами
    async createZIP(nameFolder) {
        return new Promise((resolve, reject) => {
            const output = fss.createWriteStream(
                `${__dirname}/../tempFiles/${nameFolder}/result.zip`
            );
            const archive = archiver('zip', {
                zlib: { level: 9 },
            });

            archive.pipe(output);

            // Добавление файлов в архив
            archive.directory(
                `${__dirname}/../tempFiles/${nameFolder}/source`,
                false
            );

            output.on('close', () => {
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.finalize();
        });
    }

    // Создание папки для одного пользователя
    async createFolder() {
        const nameFolder = uuidv4();

        await fs.mkdir(`${__dirname}/../tempFiles/${nameFolder}/source`, {
            recursive: true,
        });

        return nameFolder;
    }

    async removeFolder(nameFolder) {
        await fs.rm(`${__dirname}/../tempFiles/${nameFolder}`, {
            recursive: true,
        });
    }

    // Создание ярлыков для: Стандартов, Элетов и Почтовый отправлений
    async createLabels(nameFolder, models) {
        for (const key in models) {
            if (models[key].length !== 0) {
                let nameFile = '';

                switch (key) {
                    case '48':
                        nameFile = 'labelPostStandart';
                        break;
                    case '50':
                        nameFile = 'labelPostElit';
                        await this.createPostMoneyLables(
                            models[key],
                            nameFolder,
                            'postMoneyElit.pdf'
                        );
                        break;
                    case '4':
                        nameFile = 'labelPostPackage';
                        await this.createPostMoneyLables(
                            models[key],
                            nameFolder,
                            'postMoneyPackage.pdf'
                        );
                        break;
                    default:
                        break;
                }

                const labelsHTML = await this.generateHTML(
                    models[key],
                    `${nameFile}.html`
                );
                await this.htmlToPDF(labelsHTML, nameFolder, `${nameFile}.pdf`);
            }
        }
    }

    // Создание ярлыков наложенного платежа для вида посылок: Элит
    async createPostMoneyLables(models, nameFolder, nameFile) {
        const postMoneyModels = models.map((value) => {
            return new PostMoneyModel(value);
        });
        const labelsHTML = await this.generateHTML(
            postMoneyModels,
            `postMoney.html`
        );
        await this.htmlToPDF(labelsHTML, nameFolder, nameFile);
    }

    // Принудительное удаление временных файлов при ошибке
    async removeTempFiles(nameFolder, nameBufferFie) {
        try {
            await fs.rm(`${__dirname}/../tempFiles/${nameFolder}`, {
                recursive: true,
            });
            await fs.rm(`${__dirname}/../buffer/${nameBufferFie}`);
        } catch {
            try {
                await fs.rm(`${__dirname}/../buffer/${nameBufferFie}`);
            } catch {}
        }
    }
}

module.exports = new WarehouseHelper();
