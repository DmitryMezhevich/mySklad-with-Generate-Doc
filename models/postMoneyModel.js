const { format } = require('@vicimpa/rubles');

module.exports = class PostMoneyModel {
    cost;
    recipient;
    sender;
    typePost;

    constructor(module) {
        this.cost = {
            number: module.product.costOfProduct.full,
            word: `${format(
                module.product.costOfProduct.full,
                '$summString'
            )} ${format(module.product.costOfProduct.full, '$summCurrency')} ${
                module.product.costOfProduct.float
            } копеек`,
        };

        const rec = module.client;
        const recPost = module.post.address;
        let recAddress = '';
        recAddress = recPost.index ? `${recPost.index}, ` : '';
        recAddress += recPost.region ? `${recPost.region} обл., ` : '';
        recAddress += recPost.district ? `${recPost.district} р-н, ` : '';
        recAddress += recPost.city ? `нас. пункт ${recPost.city}, ` : '';
        recAddress += recPost.street ? `${recPost.street} ` : '';
        recAddress += recPost.house ? `${recPost.house}, ` : '';
        recAddress += recPost.addHouse ? `корпус ${recPost.addHouse}, ` : '';
        recAddress += recPost.apartment ? `кв. ${recPost.apartment}, ` : '';

        this.recipient = {
            name: `${rec.surname} ${rec.name} ${rec.patronymic}, ${rec.phone}`,
            address: recAddress,
        };

        this.sender = {
            name: 'ИП Межевич Дмитрий Сергеевич, +375 29 560-92-13',
            address:
                '220024, г. Минск,  Асаналиева 40Б, До востребования, УНП: 491643493, BIC: ALFABY2X, ЗАО "Альфа-Банк", IBAN: BY68ALFA30132E03790010270000',
        };

        this.typePost = module.post.delivery.type;
    }
};
