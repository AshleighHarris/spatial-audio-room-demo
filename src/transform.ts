//
//  Created by Ken Cooke on 3/11/22.
//  Copyright 2022 High Fidelity, Inc.
//
//  The contents of this file are PROPRIETARY AND CONFIDENTIAL, and may not be
//  used, disclosed to third parties, copied or duplicated in any form, in whole
//  or in part, without the prior written consent of High Fidelity, Inc.
//

'use strict';

import type { UID } from 'agora-rtc-sdk-ng';
// import { sourceMetadata } from './hifi-audio.js';
// declare function sourceMetadata(buffer : ArrayBuffer, uid : UID): void;

interface TransformStreamWithID extends TransformStream {
    uid? : UID | undefined
}

interface MetadataBounceBuffer {
    data : ArrayBuffer
}

const METADATA_BYTES = 5;
export let metadata : MetadataBounceBuffer = {
    data: new Uint8Array(METADATA_BYTES)
};

export function senderTransform(readableStream : ReadableStream, writableStream : WritableStream) : void {
    const transformStream = new TransformStream({
        start() { console.log('%cworker set sender transform', 'color:yellow'); },
        transform(encodedFrame, controller) {

            let src = new Uint8Array(encodedFrame.data);
            let len = encodedFrame.data.byteLength;

            // create dst buffer with METADATA_BYTES extra bytes
            let dst = new Uint8Array(len + METADATA_BYTES);

            // copy src data
            for (let i = 0; i < len; ++i) {
                dst[i] = src[i];
            }

            // insert metadata at the end
            let data = new Uint8Array(metadata.data);
            for (let i = 0; i < METADATA_BYTES; ++i) {
                dst[len + i] = data[i];
            }

            encodedFrame.data = dst.buffer;
            controller.enqueue(encodedFrame);
        },
    });
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}

export function receiverTransform(readableStream : ReadableStream, writableStream : WritableStream, uid : UID,
                                  sourceMetadata : Function) : void {
    const transformStream : TransformStreamWithID = new TransformStream({
        start() { console.log('%cworker set receiver transform for uid:', 'color:yellow', uid); },
        transform(encodedFrame, controller) {

            let src = new Uint8Array(encodedFrame.data);
            let len = encodedFrame.data.byteLength;

            if (len < METADATA_BYTES) {

                console.log('%cWARNING: receiver transform has no metadata! uid:', 'color:yellow', uid);
                controller.enqueue(encodedFrame);

            } else {

                // create dst buffer with METADATA_BYTES fewer bytes
                len -= METADATA_BYTES;
                let dst = new Uint8Array(len);

                // copy src data
                for (let i = 0; i < len; ++i) {
                    dst[i] = src[i];
                }

                // extract metadata at the end
                let data = new Uint8Array(METADATA_BYTES);
                for (let i = 0; i < METADATA_BYTES; ++i) {
                    data[i] = src[len + i];
                }
                sourceMetadata(data.buffer, uid);

                encodedFrame.data = dst.buffer;
                controller.enqueue(encodedFrame);
            }
        },
    });
    transformStream.uid = uid;
    readableStream.pipeThrough(transformStream).pipeTo(writableStream);
}
