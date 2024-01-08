module.exports = class WarrantyModel {
    first;
    second;

    constructor(argumentFirst, argumentSecond = '') {
        const first = argumentFirst.product;
        const second = argumentSecond ? argumentSecond.product : '';

        const dayFirst = first.dateOfDispatch
            ? first.dateOfDispatch.getDate().toString().padStart(2, '0')
            : '';
        const monthFirst = first.dateOfDispatch
            ? (first.dateOfDispatch.getMonth() + 1).toString().padStart(2, '0')
            : '';
        const yearFirst = first.dateOfDispatch
            ? first.dateOfDispatch.getFullYear()
            : '';

        let daySecond,
            monthSecond,
            yearSecond = '';

        if (second) {
            daySecond = second.dateOfDispatch
                ? second.dateOfDispatch.getDate().toString().padStart(2, '0')
                : '';
            monthSecond = second.dateOfDispatch
                ? (second.dateOfDispatch.getMonth() + 1)
                      .toString()
                      .padStart(2, '0')
                : '';
            yearSecond = second.dateOfDispatch
                ? second.dateOfDispatch.getFullYear()
                : '';
        }

        this.first = {
            productName: first.name,
            type: first.type,
            warrantyNumber: first.numberOfGarranty,
            dateOfDispatch: `${dayFirst}.${monthFirst}.${yearFirst}`,
            warrantyPeriod: first.warrantyPeriod,
            customer: first.customer,
        };

        this.second = {
            productName: second ? second.name : '',
            type: second ? second.type : '',
            warrantyNumber: second ? second.numberOfGarranty : '',
            dateOfDispatch: second
                ? `${daySecond}.${monthSecond}.${yearSecond}`
                : '',
            warrantyPeriod: second ? second.warrantyPeriod : '',
            customer: second ? second.customer : '',
        };
    }
};
