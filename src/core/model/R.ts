import { eurlEnum } from "../common/enum/eurlEnum";

export abstract class R{
    abstract url(): string;

    getMethod(): 'GET'|'POST'{
        return 'GET';
    }

    getHost(): eurlEnum{
        return eurlEnum.EH;
    }
}