// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import {
  FOUND_CLASSES,
  GenericSearchProvider
} from '@jupyterlab/documentsearch';
import { Widget } from '@lumino/widgets';

const MATCH_CLASSES = FOUND_CLASSES.join(' ');

describe('documentsearch/genericsearchprovider', () => {
  describe('GenericSearchProvider', () => {
    let provider: GenericSearchProvider;
    let widget: Widget;

    beforeEach(() => {
      widget = new Widget();
      provider = new GenericSearchProvider(widget);
    });

    afterEach(async () => {
      widget.dispose();
    });

    describe('#startQuery()', () => {
      it.each([
        [/x/, '<pre>xyz</pre>', `<mark class="${MATCH_CLASSES}">x</mark>yz`],
        [/y/, '<pre>xyz</pre>', `x<mark class="${MATCH_CLASSES}">y</mark>z`],
        [/z/, '<pre>xyz</pre>', `xy<mark class="${MATCH_CLASSES}">z</mark>`],
        [
          /x/,
          '<pre><span>x</span>yz</pre>',
          `<span><mark class="${MATCH_CLASSES}">x</mark></span>yz`
        ],
        [
          /y/,
          '<pre><span>x</span>yz</pre>',
          `<span>x</span><mark class="${MATCH_CLASSES}">y</mark>z`
        ],
        [
          /z/,
          '<pre><span>x</span>yz</pre>',
          `<span>x</span>y<mark class="${MATCH_CLASSES}">z</mark>`
        ],
        [
          /x/,
          '<pre>x<span>y</span>z</pre>',
          `<mark class="${MATCH_CLASSES}">x</mark><span>y</span>z`
        ],
        [
          /y/,
          '<pre>x<span>y</span>z</pre>',
          `x<span><mark class="${MATCH_CLASSES}">y</mark></span>z`
        ],
        [
          /z/,
          '<pre>x<span>y</span>z</pre>',
          `x<span>y</span><mark class="${MATCH_CLASSES}">z</mark>`
        ],
        [
          /x/,
          '<pre>xy<span>z</span></pre>',
          `<mark class="${MATCH_CLASSES}">x</mark>y<span>z</span>`
        ],
        [
          /y/,
          '<pre>xy<span>z</span></pre>',
          `x<mark class="${MATCH_CLASSES}">y</mark><span>z</span>`
        ],
        [
          /z/,
          '<pre>xy<span>z</span></pre>',
          `xy<span><mark class="${MATCH_CLASSES}">z</mark></span>`
        ]
      ])(
        'should highlight %s fragment in %s',
        async (query, content, expected) => {
          widget.node.innerHTML = content;
          await provider.startQuery(query);
          expect(widget.node.firstElementChild!.innerHTML).toEqual(expected);
        }
      );
    });

    describe('#endQuery()', () => {
      it.each([
        [/x/, '<pre>xyz</pre>'],
        [/y/, '<pre>xyz</pre>'],
        [/z/, '<pre>xyz</pre>'],
        [/x/, '<pre><span>x</span>yz</pre>'],
        [/y/, '<pre><span>x</span>yz</pre>'],
        [/z/, '<pre><span>x</span>yz</pre>'],
        [/x/, '<pre>x<span>y</span>z</pre>'],
        [/y/, '<pre>x<span>y</span>z</pre>'],
        [/z/, '<pre>x<span>y</span>z</pre>'],
        [/x/, '<pre>xy<span>z</span></pre>'],
        [/y/, '<pre>xy<span>z</span></pre>'],
        [/z/, '<pre>xy<span>z</span></pre>']
      ])(
        'should restore highlighted %s fragment in %s',
        async (query, content) => {
          widget.node.innerHTML = content;
          await provider.startQuery(query);
          await provider.endQuery();
          expect(widget.node.innerHTML).toEqual(content);
        }
      );
    });
  });
});
