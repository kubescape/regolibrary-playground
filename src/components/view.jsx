import SplitPane, { Pane } from 'split-pane-react';
import 'split-pane-react/esm/themes/default.css'
import { useState } from 'react';

function Basic ({tabs, codeEditor}) {
    const [sizes, setSizes] = useState([
        100,
        '30%',
        'auto',
    ]);

    const layoutCSS = {
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    return (
        <div style={{ height: 1000 }}>
            <SplitPane
                split='vertical'
                sizes={sizes}
                onChange={setSizes}
            >
                <Pane  maxSize='50%'>
                    {tabs}
                </Pane>
                {codeEditor}
            </SplitPane>
        </div>
    );
};

export default Basic;