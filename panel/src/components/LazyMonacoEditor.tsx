import { lazy, Suspense, type CSSProperties } from 'react';

type EditorProps = import('@monaco-editor/react').EditorProps;
type Monaco = import('@monaco-editor/react').Monaco;

// Lazy load Monaco Editor to reduce initial bundle size
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface LazyMonacoEditorProps extends EditorProps {
    height?: string;
}

// Theme configuration
const TXADMIN_DARK_THEME = 'txadmin-dark';
const editorFallbackStyle: CSSProperties = {
    height: '400px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: '14px',
};

/**
 * Configures Monaco Editor theme
 */
const configureMonacoTheme = (monaco: Monaco) => {
    monaco.editor.defineTheme(TXADMIN_DARK_THEME, {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {},
    });
    monaco.editor.setTheme(TXADMIN_DARK_THEME);
};

/**
 * Lazy-loaded Monaco Editor wrapper
 * Reduces initial bundle size by ~3MB
 */
export function LazyMonacoEditor(props: LazyMonacoEditorProps) {
    const handleBeforeMount = (monaco: Monaco) => {
        configureMonacoTheme(monaco);
        // Call original beforeMount if provided
        props.beforeMount?.(monaco);
    };

    return (
        <Suspense
            fallback={
                <div
                    style={{
                        ...editorFallbackStyle,
                        height: props.height || editorFallbackStyle.height,
                    }}
                >
                    Loading editor…
                </div>
            }
        >
            <MonacoEditor {...props} theme={TXADMIN_DARK_THEME} beforeMount={handleBeforeMount} />
        </Suspense>
    );
}
