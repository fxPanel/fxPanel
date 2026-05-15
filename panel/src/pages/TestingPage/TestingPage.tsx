import TmpAuthState from './TmpAuthState';
import TmpColors from './TmpColors';
import TmpMarkdown from './TmpMarkdown';
import TmpWarningBarState from './TmpWarningBarState';
import TmpSocket from './TmpSocket';
import TmpToasts from './TmpToasts';
import TmpApi from './TmpApi';
import TmpFiller from './TmpFiller';
import TmpDndSortable from './TmpDndSortable';
import TmpSwr from './TmpSwr';
import TmpJsonEditor from './TmpJsonEditor';
import TmpPageHeader from './TmpPageHeader';

export default function TestingPage() {
    // useEffect(() => {
    //     return () => console.clear();
    // }, []);

    return (
        <div className="flex w-full flex-col gap-4">
            <TmpFiller />
            {/* <TmpTestTables /> */}
            {/* <TmpApi /> */}
            {/* <TmpToasts /> */}
            {/* <TmpSocket /> */}
            {/* <TmpWarningBarState /> */}
            {/* <TmpAuthState /> */}
            {/* <TmpMarkdown /> */}
            {/* <TmpColors /> */}
            {/* <TmpDndSortable /> */}
            {/* <TmpSwr /> */}
            {/* <div className="mx-auto">
            <TmpServerCard />
        </div> */}
            {/* <TmpJsonEditor /> */}
            {/* <TmpPageHeader /> */}
        </div>
    );
}
