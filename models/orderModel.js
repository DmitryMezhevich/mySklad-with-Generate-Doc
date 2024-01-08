module.exports = class OrderModel {
    order;
    product;
    client;
    post;

    constructor(module) {
        const costOfProduct = parseFloat(module.K.replace(',', '.'));
        const costOfDelivery = module.AF
            ? parseFloat(module.AF.replace(',', '.'))
            : '';

        this.order = {
            number: module.A, // Номер заказа
            status: module.L, // Статус заказа
            date: {
                registration: module.B, // Дата оформления заказа
                dispatch: module.C, // Дата отгрузки заказа
                receipt: module.M, // Дата, когда посылка приехала на почту к клиенту
                storage: module.N, // Дата крайняя хранения у клиента на почте
                delivery: module.O, // Дата вручения/возврата посылки
            },
            document: {
                product: module.D, // Документы на товар
                shipment: module.E, // Документы на отгрузку
            },
        };

        this.product = {
            numberOfGarranty: module.F, // Номер гарантийного талона
            additionalMarks: module.G, // Дополнительные отметки в гарантийном талоне
            name: module.H, // Наименование товара
            amount: module.I, // Количество
            type: module.J, // Тип (модель)
            costOfProduct: {
                // Стоимость
                integer: Math.floor(costOfProduct),
                float:
                    (costOfProduct - Math.floor(costOfProduct)).toFixed(2) *
                    100,
                full: costOfProduct.toFixed(2),
            },
            dateOfDispatch: module.C, // Дата продажи, совподает с датой отгрузки
            warrantyPeriod: '60 дней', // Срок гарантии
            customer: module.S // Покупатель (вид: Иванов И.И.)
                ? `${module.S} ${module.T.charAt(0).toUpperCase() ?? ''}.${
                      module.U.charAt(0).toUpperCase() ?? ''
                  }.`
                : '',
        };

        this.client = {
            surname: module.S, // Фамилия
            name: module.T, // Имя
            patronymic: module.U, // Отчество
            phone: module.R, // Мобильный номер
            notes: module.P, // Заметки
        };

        let typyOfDelivery = '';
        if (module.AD.toLowerCase().includes('стан')) {
            typyOfDelivery = 48;
        } else if (module.AD.toLowerCase().includes('эли')) {
            typyOfDelivery = 50;
        } else if (module.AD.toLowerCase().includes('пос')) {
            typyOfDelivery = 4;
        }

        this.post = {
            address: {
                region: module.V, // Область
                district: module.W, // Район
                city: module.X, // Населенный пункт
                street: module.Y, // Улица
                house: module.Z, // Дом
                apartment: module.AA, // Квартира
                addHouse: module.AC, // Корпус
                index: module.AB, // Индекс
            },
            delivery: {
                type: typyOfDelivery, // Тип доставки: Стандарт - 48, Элит - 50, Посылка (без ОЦ) - 4
                customer: module.AE.toLowerCase().includes('кл'), // Кто платит за доставку: Клиент(True), Продавец(False)
                cost: {
                    // Стоимость
                    integer: Math.floor(costOfDelivery),
                    float:
                        (costOfDelivery - Math.floor(costOfDelivery)).toFixed(
                            2
                        ) * 100,
                },
            },
            barcode: {
                incompleteCode: module.Q, // Трек-номер без контрольной цифры
                fullCode: '', // Трек-номер с контрольной цифрой
                svg: '', // Изображение штрихкода
            },
        };
    }
};
