Array.prototype.asyncFind = async function (predicate) {
    for (let i = 0; i < this.length; i++) {
        if (await predicate(this[i], i, this)) {
            return this[i];
        }
    }
    return undefined;
};

Array.prototype.asyncFindIndex = async function (predicate) {
    for (let i = 0; i < this.length; i++) {
        if (await predicate(this[i], i, this)) {
            return i;
        }
    }
    return -1;
};

Array.prototype.asyncMap = async function (callback) {
    const results = [];
    for (let i = 0; i < this.length; i++) {
        results.push(await callback(this[i], i, this));
    }
    return results;
};
