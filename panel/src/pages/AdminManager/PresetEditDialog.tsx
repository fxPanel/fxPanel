import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2Icon } from 'lucide-react';
import { PermissionPreset } from '@shared/permissions';
import { txToast } from '@/components/TxToaster';
import PermissionsEditor from './PermissionsEditor';

type PresetEditDialogProps = {
    target: PermissionPreset | 'new';
    onClose: () => void;
    onSave: (preset: PermissionPreset) => Promise<void>;
    isSaving: boolean;
};

export default function PresetEditDialog({ target, onClose, onSave, isSaving }: PresetEditDialogProps) {
    const isNew = target === 'new';

    const [name, setName] = useState(isNew ? '' : target.name);
    const [permissions, setPermissions] = useState<string[]>(isNew ? [] : target.permissions);

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            txToast.error({ title: 'Validation Error', msg: 'Preset name is required.' });
            return;
        }
        if (permissions.length === 0) {
            txToast.error({ title: 'Validation Error', msg: 'Select at least one permission.' });
            return;
        }
        await onSave({
            id: isNew ? '' : target.id,
            name: trimmedName,
            permissions,
        });
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>{isNew ? 'Create Preset' : `Edit Preset: ${target.name}`}</DialogTitle>
                </DialogHeader>

                <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
                    <div className="space-y-4 pb-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="preset-name">Preset Name</Label>
                            <Input
                                id="preset-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Senior Moderator"
                            />
                        </div>

                        <Separator />

                        <PermissionsEditor selected={permissions} onChange={setPermissions} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
                        {isNew ? 'Create Preset' : 'Save Preset'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
