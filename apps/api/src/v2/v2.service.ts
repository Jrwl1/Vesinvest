import { Injectable } from '@nestjs/common';
import { V2CoreSupport } from './v2-core-support';

@Injectable()
export class V2Service extends V2CoreSupport {}
