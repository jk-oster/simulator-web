// From: https://github.com/coverslide/node-alea - inspired by http://baagoe.com/en/RandomMusings/javascript/
'use strict';

class Mash {
    version = 'Mash 0.9';
    n = 0xefc8249d;

    mash(data) {
        data = data.toString();
        for (let i = 0; i < data.length; i++) {
            this.n += data.charCodeAt(i);
            let h = 0.02519603282416938 * this.n;
            this.n = h >>> 0;
            h -= this.n;
            h *= this.n;
            this.n = h >>> 0;
            h -= this.n;
            this.n += h * 0x100000000; // 2^32
        }
        return (this.n >>> 0) * 2.3283064365386963e-10; // 2^-32
    }
}

export default class Alea {
    constructor(...args) {
        // Johannes Baagøe <baagoe@baagoe.com>, 2010
        this.s0 = 0;
        this.s1 = 0;
        this.s2 = 0;
        this.c = 1;

        if (args.length === 0) {
            args = [+new Date()];
        }
        this.mash = new Mash();
        this.s0 = this.mash(' ');
        this.s1 = this.mash(' ');
        this.s2 = this.mash(' ');

        for (let i = 0; i < args.length; i++) {
            this.s0 -= this.mash(args[i]);
            if (this.s0 < 0) {
                this.s0 += 1;
            }
            this.s1 -= this.mash(args[i]);
            if (this.s1 < 0) {
                this.s1 += 1;
            }
            this.s2 -= this.mash(args[i]);
            if (this.s2 < 0) {
                this.s2 += 1;
            }
        }
        this.mash = null;
    }

    random() {
        const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10; // 2^-32
        this.s0 = this.s1;
        this.s1 = this.s2;
        return (this.s2 = t - (this.c = t | 0));
    }

    uint32() {
        return this.random() * 0x100000000; // 2^32
    }

    fract53() {
        return this.random() + (this.random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
    }

    exportState() {
        return [this.s0, this.s1, this.s2, this.c];
    }

    importState(i) {
        this.s0 = +i[0] || 0;
        this.s1 = +i[1] || 0;
        this.s2 = +i[2] || 0;
        this.c = +i[3] || 0;
    }
}
