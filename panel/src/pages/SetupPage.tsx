import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useBackendApi } from '@/hooks/fetch';
import { txToast } from '@/components/TxToaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Loader2Icon,
    ChevronRightIcon,
    ChevronLeftIcon,
    CheckIcon,
    ServerIcon,
    GlobeIcon,
    FileCodeIcon,
    FolderOpenIcon,
} from 'lucide-react';
import useSWR from 'swr';
import { navigate as setLocation } from 'wouter/use-browser-location';
import { ApiTimeout } from '@/hooks/fetch';

// - -  Types - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
type SetupDataResp = {
    redirect?: string;
    error?: string;
    skipServerName: boolean;
    serverName: string;
    deployerEngineVersion: string;
    forceGameName: string;
    dataPath: string;
    hasCustomDataPath: boolean;
    hostConfigSource: string;
};

type RecipeEntry = {
    engine: string;
    name: string;
    author: string;
    version: string;
    description: string;
    url: string;
    tags: string[];
};

type DeploymentType = 'popular' | 'local' | 'remote' | 'custom';

type ValidateResp = {
    success: boolean;
    name?: string;
    message?: string;
    suggestion?: string;
    detectedConfig?: string;
};

type SaveResp = {
    success: boolean;
    refresh?: boolean;
    message?: string;
};

type SetupPageState = {
    step: number;
    serverName: string;
    deployType: DeploymentType | null;
    selectedRecipe: RecipeEntry | null;
    recipeURL: string;
    recipeName: string;
    dataFolder: string;
    detectedConfig: string | undefined;
    deployPath: string;
    cfgFile: string;
    saving: boolean;
    errorMessage: string | null;
};

const reduceSetupPageState = (state: SetupPageState, action: Partial<SetupPageState>) => {
    return {
        ...state,
        ...action,
    };
};

// - -  Helpers - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
function buildDeployName(templateName: string) {
    const sanitized = templateName
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 12)
        .toLowerCase();
    const ts = Date.now().toString(16);
    const id = `${sanitized}_${ts}`;
    return { id, path: '' }; // path is filled in step 4
}

function tagColor(tag: string) {
    if (tag === 'fivem') return 'bg-orange-500 text-white';
    if (tag === 'redm') return 'bg-red-600 text-white';
    return 'bg-muted text-muted-foreground';
}

// - -  Step Components - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

/** Step 1: Server Name */
function StepServerName({
    serverName,
    setServerName,
    onNext,
}: {
    serverName: string;
    setServerName: (v: string) => void;
    onNext: () => void;
}) {
    const valid = serverName.length >= 3 && serverName.length <= 22;
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Server Name</h2>
            <p className="text-muted-foreground text-sm">
                Choose a name for your server. This can be changed later in Settings.
            </p>
            <Input
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && valid && onNext()}
                placeholder="Happy Server"
                maxLength={22}
                minLength={3}
            />
            <div className="flex justify-end">
                <Button onClick={onNext} disabled={!valid}>
                    Next <ChevronRightIcon className="ml-1 size-4" />
                </Button>
            </div>
        </div>
    );
}

/** Step 2: Deployment Type */
function StepDeploymentType({ onSelect }: { onSelect: (t: DeploymentType) => void }) {
    const cards: { type: DeploymentType; icon: React.ReactNode; title: string; desc: string; badge?: string }[] = [
        {
            type: 'popular',
            icon: <ServerIcon className="size-8" />,
            title: 'Popular Recipes',
            desc: 'Choose from a list of popular community recipes.',
            badge: 'RECOMMENDED',
        },
        {
            type: 'local',
            icon: <FolderOpenIcon className="size-8" />,
            title: 'Existing Server Data',
            desc: 'Point to an existing server data folder with a server.cfg.',
        },
        {
            type: 'remote',
            icon: <GlobeIcon className="size-8" />,
            title: 'Remote URL Template',
            desc: 'Provide a URL to a recipe YAML file.',
        },
        {
            type: 'custom',
            icon: <FileCodeIcon className="size-8" />,
            title: 'Custom Template',
            desc: 'Start with a blank recipe and paste your own in the deployer.',
        },
    ];

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Deployment Type</h2>
            <p className="text-muted-foreground text-sm">How would you like to set up your server?</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {cards.map((c) => (
                    <button
                        key={c.type}
                        onClick={() => onSelect(c.type)}
                        className="border-border hover:border-primary hover:bg-accent relative flex flex-col items-center gap-2 rounded-lg border p-6 text-center transition-colors"
                    >
                        {c.badge && (
                            <span className="absolute top-2 right-2 rounded bg-green-600 px-2 py-0.5 text-xs text-white">
                                {c.badge}
                            </span>
                        )}
                        {c.icon}
                        <span className="font-semibold">{c.title}</span>
                        <span className="text-muted-foreground text-xs">{c.desc}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Step 3: Popular template picker */
function StepPopularTemplates({
    engineVersion,
    forceGameName,
    onSelect,
    onBack,
}: {
    engineVersion: string;
    forceGameName: string;
    onSelect: (recipe: RecipeEntry) => void;
    onBack: () => void;
}) {
    const recipesKey = `setupRecipeIndex:${forceGameName || 'all'}`;
    const {
        data: recipes,
        error: recipesError,
        isLoading: isLoadingRecipes,
    } = useSWR<RecipeEntry[]>(recipesKey, async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
            const response = await fetch('https://raw.githubusercontent.com/citizenfx/txAdmin-recipes/main/indexv4.json', {
                signal: controller.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const data = (await response.json()) as RecipeEntry[];
            if (!forceGameName) return data;

            return data.filter((recipe) => recipe.tags.includes(forceGameName));
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new Error('Request timed out while loading recipes.');
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    });
    const fetchError = recipesError
        ? recipesError.message === 'Request timed out while loading recipes.'
            ? recipesError.message
            : `Failed to load recipes index: ${recipesError.message}`
        : '';

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ChevronLeftIcon className="size-4" />
                </Button>
                <h2 className="text-xl font-semibold">Select a Template</h2>
            </div>
            {fetchError && <p className="text-destructive">{fetchError}</p>}
            {isLoadingRecipes && !fetchError && (
                <div className="flex items-center gap-2">
                    <Loader2Icon className="animate-spin" /> Loading recipesâ€¦
                </div>
            )}
            {recipes && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {recipes.map((r) => {
                        const incompatible = r.engine !== engineVersion;
                        return (
                            <button
                                key={r.url}
                                onClick={() => !incompatible && onSelect(r)}
                                disabled={incompatible}
                                className="border-border hover:border-primary hover:bg-accent flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors disabled:opacity-50"
                            >
                                <span className="font-semibold">{r.name}</span>
                                <span className="text-muted-foreground text-xs">
                                    by {r.author} &middot; v{r.version}
                                </span>
                                <span className="text-muted-foreground text-sm">{r.description}</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {incompatible && (
                                        <span className="rounded bg-red-700 px-2 py-0.5 text-xs text-white">
                                            INCOMPATIBLE
                                        </span>
                                    )}
                                    {r.tags.map((t) => (
                                        <span key={t} className={`rounded px-2 py-0.5 text-xs ${tagColor(t)}`}>
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** Step 3: Remote URL input */
function StepRemoteURL({
    onValidated,
    onBack,
}: {
    onValidated: (url: string, name: string) => void;
    onBack: () => void;
}) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);

    const validateApi = useBackendApi<ValidateResp>({
        method: 'POST',
        path: '/setup/validateRecipeURL',
    });

    const handleValidate = () => {
        if (!url.trim()) return;
        setLoading(true);
        validateApi({
            data: { recipeURL: url.trim() },
            success(data) {
                setLoading(false);
                if (data.success && data.name) {
                    onValidated(url.trim(), data.name);
                } else {
                    txToast.error(data.message || 'Invalid recipe URL.');
                }
            },
            error(msg) {
                setLoading(false);
                txToast.error(msg);
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ChevronLeftIcon className="size-4" />
                </Button>
                <h2 className="text-xl font-semibold">Remote Template URL</h2>
            </div>
            <p className="text-muted-foreground text-sm">Paste the URL of a recipe YAML file (must be a raw URL).</p>
            <Alert variant="destructive">
                <AlertTitle>Untrusted recipes</AlertTitle>
                <AlertDescription>
                    A recipe is executable configuration (including SQL). Only load templates from sources you trust.
                    Arbitrary URLs or third-party raw files can compromise your server or database if the YAML is malicious.
                </AlertDescription>
            </Alert>
            <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                placeholder="https://raw.githubusercontent.com/..."
            />
            <div className="flex justify-end">
                <Button onClick={handleValidate} disabled={loading || !url.trim()}>
                    {loading && <Loader2Icon className="mr-1 size-4 animate-spin" />}
                    Validate
                </Button>
            </div>
        </div>
    );
}

/** Step 3: Local data folder */
function StepLocalDataFolder({
    onValidated,
    onBack,
}: {
    onValidated: (dataFolder: string, detectedConfig?: string) => void;
    onBack: () => void;
}) {
    const [folder, setFolder] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestion, setSuggestion] = useState<string | null>(null);

    const validateApi = useBackendApi<ValidateResp>({
        method: 'POST',
        path: '/setup/validateLocalDataFolder',
    });

    const handleValidate = (overrideFolder?: string) => {
        const f = (overrideFolder ?? folder).trim();
        if (!f) return;
        setLoading(true);
        setSuggestion(null);
        validateApi({
            data: { dataFolder: f },
            success(data) {
                setLoading(false);
                if (data.success) {
                    onValidated(f, data.detectedConfig);
                } else if (data.suggestion) {
                    setSuggestion(data.suggestion);
                    txToast.warning(data.message || 'Found a suggestion.');
                } else {
                    txToast.error(data.message || 'Invalid folder.');
                }
            },
            error(msg) {
                setLoading(false);
                txToast.error(msg);
            },
        });
    };

    const acceptSuggestion = () => {
        if (suggestion) {
            setFolder(suggestion);
            handleValidate(suggestion);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ChevronLeftIcon className="size-4" />
                </Button>
                <h2 className="text-xl font-semibold">Existing Server Data Folder</h2>
            </div>
            <p className="text-muted-foreground text-sm">
                Provide the path to your existing server data folder (containing server.cfg and resources/).
            </p>
            <Input
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                placeholder="/path/to/server-data"
            />
            {suggestion && (
                <div className="border-warning/30 bg-warning-hint flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <span>
                        Suggestion: <code className="font-mono text-xs">{suggestion}</code>
                    </span>
                    <Button size="sm" variant="outline" onClick={acceptSuggestion}>
                        Accept Fix
                    </Button>
                </div>
            )}
            <div className="flex justify-end">
                <Button onClick={() => handleValidate()} disabled={loading || !folder.trim()}>
                    {loading && <Loader2Icon className="mr-1 size-4 animate-spin" />}
                    Validate
                </Button>
            </div>
        </div>
    );
}

/** Step 3: Custom template info */
function StepCustomInfo({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ChevronLeftIcon className="size-4" />
                </Button>
                <h2 className="text-xl font-semibold">Custom Template</h2>
            </div>
            <p className="text-muted-foreground text-sm">
                You will be able to paste or write your own recipe YAML in the deployer editor on the next page.
            </p>
            <p className="text-muted-foreground text-sm">
                For recipe documentation and examples, check the{' '}
                <a
                    href="https://fxpanel.org/docs/recipe"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                >
                    fxPanel docs
                </a>
                .
            </p>
            <div className="flex justify-end">
                <Button onClick={onNext}>
                    Next <ChevronRightIcon className="ml-1 size-4" />
                </Button>
            </div>
        </div>
    );
}

/** Step 4: Deploy Target Path (for popular/remote/custom) */
function StepDeployTarget({
    defaultPath,
    hasCustomDataPath,
    onValidated,
    onBack,
}: {
    defaultPath: string;
    hasCustomDataPath: boolean;
    onValidated: (deployPath: string) => void;
    onBack: () => void;
}) {
    const initialDeployPathRef = useRef(defaultPath);
    const [deployPath, setDeployPath] = useState(initialDeployPathRef.current);
    const [editable, setEditable] = useState(false);
    const [loading, setLoading] = useState(false);

    const validateApi = useBackendApi<ValidateResp>({
        method: 'POST',
        path: '/setup/validateLocalDeployPath',
    });

    const handleValidate = () => {
        if (!deployPath.trim()) return;
        setLoading(true);
        validateApi({
            data: { deployPath: deployPath.trim() },
            success(data) {
                setLoading(false);
                if (data.success) {
                    onValidated(deployPath.trim());
                } else {
                    txToast.error(data.message || 'Invalid deploy path.');
                }
            },
            error(msg) {
                setLoading(false);
                txToast.error(msg);
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ChevronLeftIcon className="size-4" />
                </Button>
                <h2 className="text-xl font-semibold">Deploy Target</h2>
            </div>
            <p className="text-muted-foreground text-sm">Where should the server data be deployed?</p>
            <div className="flex items-center gap-2">
                <Input
                    value={deployPath}
                    onChange={(e) => setDeployPath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                    disabled={!editable}
                    className="flex-1"
                />
                {!editable && (
                    <Button variant="outline" size="sm" onClick={() => setEditable(true)}>
                        Change Path
                    </Button>
                )}
            </div>
            {hasCustomDataPath && (
                <p className="text-muted-foreground text-xs">
                    This path is based on your custom data path configuration.
                </p>
            )}
            <div className="flex justify-end">
                <Button onClick={handleValidate} disabled={loading || !deployPath.trim()}>
                    {loading && <Loader2Icon className="mr-1 size-4 animate-spin" />}
                    Validate & Continue
                </Button>
            </div>
        </div>
    );
}

/** Step 4: Server CFG path (for local type) */
function StepServerCFG({
    detectedConfig,
    dataFolder,
    onValidated,
    onBack,
}: {
    detectedConfig?: string;
    dataFolder: string;
    onValidated: (cfgFile: string) => void;
    onBack: () => void;
}) {
    const [cfgFile, setCfgFile] = useState(detectedConfig || '');
    const [loading, setLoading] = useState(false);

    const validateApi = useBackendApi<ValidateResp>({
        method: 'POST',
        path: '/setup/validateCFGFile',
    });

    const handleValidate = () => {
        if (!cfgFile.trim()) return;
        setLoading(true);
        validateApi({
            data: { template: false, dataFolder, cfgFile: cfgFile.trim() },
            success(data) {
                setLoading(false);
                if (data.success) {
                    onValidated(cfgFile.trim());
                } else {
                    txToast.error(data.message || 'Invalid CFG file.');
                }
            },
            error(msg) {
                setLoading(false);
                txToast.error(msg);
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ChevronLeftIcon className="size-4" />
                </Button>
                <h2 className="text-xl font-semibold">Server CFG File</h2>
            </div>
            <p className="text-muted-foreground text-sm">
                Provide the server.cfg file name (relative to your data folder).
            </p>
            <Input
                value={cfgFile}
                onChange={(e) => setCfgFile(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                placeholder="server.cfg"
            />
            <div className="flex justify-end">
                <Button onClick={handleValidate} disabled={loading || !cfgFile.trim()}>
                    {loading && <Loader2Icon className="mr-1 size-4 animate-spin" />}
                    Validate
                </Button>
            </div>
        </div>
    );
}

// - -  Main Setup Page - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
type SetupStepContentProps = {
    step: number;
    data: SetupDataResp;
    deployType: DeploymentType | null;
    serverName: string;
    setServerName: (value: string) => void;
    selectedRecipe: RecipeEntry | null;
    recipeName: string;
    dataFolder: string;
    detectedConfig?: string;
    defaultDeployPath: string;
    deployPath: string;
    cfgFile: string;
    saving: boolean;
    onSetStep: (step: number) => void;
    onSelectDeployType: (deployType: DeploymentType) => void;
    onSelectPopularRecipe: (recipe: RecipeEntry) => void;
    onValidateRemoteRecipe: (url: string, name: string) => void;
    onValidateLocalDataFolder: (folder: string, detected?: string) => void;
    onValidateCfg: (cfg: string) => void;
    onValidateDeployPath: (path: string) => void;
    onSave: () => void;
};

const SetupStepContent = ({
    step,
    data,
    deployType,
    serverName,
    setServerName,
    selectedRecipe,
    recipeName,
    dataFolder,
    detectedConfig,
    defaultDeployPath,
    deployPath,
    cfgFile,
    saving,
    onSetStep,
    onSelectDeployType,
    onSelectPopularRecipe,
    onValidateRemoteRecipe,
    onValidateLocalDataFolder,
    onValidateCfg,
    onValidateDeployPath,
    onSave,
}: SetupStepContentProps) => {
    if (step === 0) {
        return <StepServerName serverName={serverName} setServerName={setServerName} onNext={() => onSetStep(1)} />;
    }

    if (step === 1) {
        return (
            <StepDeploymentType
                onSelect={(selectedDeployType) => {
                    onSelectDeployType(selectedDeployType);
                    onSetStep(2);
                }}
            />
        );
    }

    if (step === 2) {
        if (deployType === 'popular') {
            return (
                <StepPopularTemplates
                    engineVersion={data.deployerEngineVersion}
                    forceGameName={data.forceGameName}
                    onSelect={onSelectPopularRecipe}
                    onBack={() => onSetStep(1)}
                />
            );
        }
        if (deployType === 'remote') {
            return <StepRemoteURL onValidated={onValidateRemoteRecipe} onBack={() => onSetStep(1)} />;
        }
        if (deployType === 'local') {
            return <StepLocalDataFolder onValidated={onValidateLocalDataFolder} onBack={() => onSetStep(1)} />;
        }
        if (deployType === 'custom') {
            return <StepCustomInfo onNext={() => onSetStep(3)} onBack={() => onSetStep(1)} />;
        }
    }

    if (step === 3) {
        if (deployType === 'local') {
            return (
                <StepServerCFG
                    detectedConfig={detectedConfig}
                    dataFolder={dataFolder}
                    onValidated={onValidateCfg}
                    onBack={() => onSetStep(2)}
                />
            );
        }

        return (
            <StepDeployTarget
                defaultPath={defaultDeployPath}
                hasCustomDataPath={data.hasCustomDataPath}
                onValidated={onValidateDeployPath}
                onBack={() => onSetStep(2)}
            />
        );
    }

    if (step === 4) {
        const isLocal = deployType === 'local';
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onSetStep(3)}>
                        <ChevronLeftIcon className="size-4" />
                    </Button>
                    <h2 className="text-xl font-semibold">Ready to Go</h2>
                </div>
                <div className="bg-muted/50 space-y-2 rounded-lg p-4 text-sm">
                    <div>
                        <strong>Server Name:</strong> {serverName}
                    </div>
                    <div>
                        <strong>Type:</strong> {deployType}
                    </div>
                    {isLocal ? (
                        <>
                            <div>
                                <strong>Data Folder:</strong> <code className="text-xs">{dataFolder}</code>
                            </div>
                            <div>
                                <strong>CFG File:</strong> <code className="text-xs">{cfgFile}</code>
                            </div>
                        </>
                    ) : (
                        <>
                            {(selectedRecipe || recipeName) && (
                                <div>
                                    <strong>Recipe:</strong> {selectedRecipe?.name || recipeName}
                                </div>
                            )}
                            <div>
                                <strong>Deploy Path:</strong> <code className="text-xs">{deployPath}</code>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-end">
                    <Button onClick={onSave} disabled={saving}>
                        {saving && <Loader2Icon className="mr-1 size-4 animate-spin" />}
                        {isLocal ? (
                            <>
                                <CheckIcon className="mr-1 size-4" /> Save & Start Server
                            </>
                        ) : (
                            <>
                                Go to Recipe Deployer <ChevronRightIcon className="ml-1 size-4" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    return null;
};

export default function SetupPage() {
    // - -  Data fetch - - 
    const dataApi = useBackendApi<SetupDataResp>({
        method: 'GET',
        path: '/setup/data',
    });
    const swrFetcher = async () => {
        let resp: SetupDataResp | undefined;
        await dataApi({
            success: (d) => {
                resp = d;
            },
        });
        return resp;
    };
    const { data, isLoading } = useSWR('/setup/data', swrFetcher, { revalidateOnFocus: false });

    // - -  Wizard state - - 
    const [state, dispatch] = useReducer(reduceSetupPageState, {
        step: 0,
        serverName: '',
        deployType: null,
        selectedRecipe: null,
        recipeURL: '',
        recipeName: '',
        dataFolder: '',
        detectedConfig: undefined,
        deployPath: '',
        cfgFile: '',
        saving: false,
        errorMessage: null,
    });
    const { step, serverName, deployType, selectedRecipe, recipeURL, recipeName, dataFolder, detectedConfig, deployPath, cfgFile, saving, errorMessage } = state;
    const initRef = useRef(false);

    const saveApi = useBackendApi<SaveResp>({
        method: 'POST',
        path: '/setup/save',
    });

    // Handle redirect or init
    useEffect(() => {
        if (!data || initRef.current) return;
        initRef.current = true;
        if (data.redirect) {
            setLocation(data.redirect);
            return;
        }
        if (data.error) {
            txToast.error(data.error);
            dispatch({ errorMessage: data.error });
            return;
        }
        dispatch({
            serverName: data.serverName,
            step: data.skipServerName ? 1 : 0,
        });
    }, [data]);

    // Build default deploy path when recipe is selected
    const deploymentTs = useMemo(() => Date.now().toString(16), [recipeName, selectedRecipe?.name]);

    const defaultDeployPath = useMemo(() => {
        if (!data?.dataPath) return '';
        const name = recipeName || selectedRecipe?.name || 'server';
        const sanitized = name
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 12)
            .toLowerCase();
        return `${data.dataPath}/${sanitized}_${deploymentTs}.base`;
    }, [data?.dataPath, recipeName, selectedRecipe?.name, deploymentTs]);

    const deploymentID = useMemo(() => {
        if (!recipeName && !selectedRecipe?.name) return '';
        const name = recipeName || selectedRecipe?.name || 'server';
        const sanitized = name
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 12)
            .toLowerCase();
        return `${sanitized}_${deploymentTs}`;
    }, [recipeName, selectedRecipe?.name, deploymentTs]);

    // - -  Save handler - - 
    const performSave = useCallback(() => {
        if (!deployType) return;
        dispatch({ saving: true });
        let payload: Record<string, any>;

        if (deployType === 'popular') {
            payload = {
                name: serverName,
                type: 'popular',
                isTrustedSource: true,
                recipeURL: selectedRecipe?.url,
                targetPath: deployPath,
                deploymentID,
            };
        } else if (deployType === 'remote') {
            payload = {
                name: serverName,
                type: 'remote',
                isTrustedSource: false,
                recipeURL,
                targetPath: deployPath,
                deploymentID,
            };
        } else if (deployType === 'custom') {
            payload = {
                name: serverName,
                type: 'custom',
                targetPath: deployPath,
                deploymentID,
            };
        } else {
            // local
            payload = {
                name: serverName,
                type: 'local',
                dataFolder,
                cfgFile,
            };
        }

        saveApi({
            data: payload,
            timeout: ApiTimeout.LONG,
            toastLoadingMessage: 'Savingâ€¦',
            success(resp) {
                dispatch({ saving: false });
                if (resp.success) {
                    if (deployType === 'local') {
                        txToast.success('Server saved. Startingâ€¦');
                        setLocation('/server/console');
                    } else {
                        setLocation('/server/deployer');
                    }
                } else {
                    txToast.error(resp.message || 'Save failed.');
                }
            },
            error(msg) {
                dispatch({ saving: false });
                txToast.error(msg);
            },
        });
    }, [deployType, serverName, selectedRecipe, recipeURL, deployPath, deploymentID, dataFolder, cfgFile, saveApi]);

    // - -  Loading state - - 
    if (isLoading || !data) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2Icon className="size-8 animate-spin" />
            </div>
        );
    }

    // - -  Error state - - 
    if (errorMessage) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3">
                <p className="text-destructive text-lg font-semibold">Setup Error</p>
                <p className="text-muted-foreground text-sm">{errorMessage}</p>
            </div>
        );
    }

    // - -  Step progress indicator - - 
    const totalSteps = deployType === 'local' ? 4 : 4; // name, type, template/path, target/cfg â†’ save
    const stepLabels =
        deployType === 'local'
            ? ['Server Name', 'Type', 'Data Folder', 'CFG File']
            : ['Server Name', 'Type', 'Template', 'Deploy Target'];

    return (
        <div className="mx-auto w-full max-w-(--breakpoint-md) space-y-6 px-2 py-4 md:px-0">
            <div className="px-2 md:px-0">
                <h1 className="mb-2 text-3xl">Server Setup</h1>
                <p className="text-muted-foreground text-sm">Follow the steps below to set up your server.</p>
            </div>

            {/* Step Progress */}
            <div className="flex items-center gap-1 px-2 md:px-0">
                {(data.skipServerName ? stepLabels.slice(1) : stepLabels).map((label, i) => {
                    const stepIndex = data.skipServerName ? i + 1 : i;
                    const isActive = step === stepIndex;
                    const isDone = step > stepIndex;
                    return (
                        <div key={label} className="flex flex-1 items-center gap-1">
                            <div
                                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                    isDone
                                        ? 'bg-primary text-primary-foreground'
                                        : isActive
                                          ? 'border-primary text-primary border-2'
                                          : 'border-muted-foreground/30 text-muted-foreground border'
                                }`}
                            >
                                {isDone ? <CheckIcon className="size-3" /> : i + 1}
                            </div>
                            <span
                                className={`hidden text-xs sm:inline ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                            >
                                {label}
                            </span>
                            {i < (data.skipServerName ? stepLabels.length - 2 : stepLabels.length - 1) && (
                                <div className={`mx-1 h-px flex-1 ${isDone ? 'bg-primary' : 'bg-border'}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Step Content */}
            <div className="rounded-lg border p-6">
                <SetupStepContent
                    step={step}
                    data={data}
                    deployType={deployType}
                    serverName={serverName}
                    setServerName={(value) => dispatch({ serverName: value })}
                    selectedRecipe={selectedRecipe}
                    recipeName={recipeName}
                    dataFolder={dataFolder}
                    detectedConfig={detectedConfig}
                    defaultDeployPath={defaultDeployPath}
                    deployPath={deployPath}
                    cfgFile={cfgFile}
                    saving={saving}
                    onSetStep={(nextStep) => dispatch({ step: nextStep })}
                    onSelectDeployType={(nextDeployType) => dispatch({ deployType: nextDeployType })}
                    onSelectPopularRecipe={(recipe) => {
                        dispatch({
                            selectedRecipe: recipe,
                            recipeName: recipe.name,
                            recipeURL: recipe.url,
                            step: 3,
                        });
                    }}
                    onValidateRemoteRecipe={(url, name) => {
                        dispatch({
                            recipeURL: url,
                            recipeName: name,
                            step: 3,
                        });
                    }}
                    onValidateLocalDataFolder={(folder, detected) => {
                        dispatch({
                            dataFolder: folder,
                            detectedConfig: detected,
                            step: 3,
                        });
                    }}
                    onValidateCfg={(cfg) => {
                        dispatch({ cfgFile: cfg, step: 4 });
                    }}
                    onValidateDeployPath={(path) => {
                        dispatch({ deployPath: path, step: 4 });
                    }}
                    onSave={performSave}
                />
            </div>
        </div>
    );
}
