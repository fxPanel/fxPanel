import { atom, useAtomValue, useSetAtom } from 'jotai';
import type { BanTemplatesDataType } from '@shared/otherTypes';

const banTemplatesAtom = atom<BanTemplatesDataType[] | undefined>(undefined);
export const useBanTemplates = () => useAtomValue(banTemplatesAtom);
export const useSetBanTemplates = () => useSetAtom(banTemplatesAtom);
