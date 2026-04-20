import { useState } from 'react';
import { Shield, Users, Lock, MessageSquare, Trash2, MonitorOff, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRoomStore } from '@/stores/roomStore';
import { useUIStore } from '@/stores/useUIStore';

export function RoomSettingsModal() {
  const roomCode = useRoomStore((s) => s.roomCode);
  const isAdmin = useRoomStore((s) => s.isAdmin);
  // These should come from your store, using defaults here for the UI
  const isLocked = useRoomStore((s) => s.isLocked) || false;
  const chatDisabled = useRoomStore((s) => s.chatDisabled) || false;
  const requireApproval = useRoomStore((s) => s.requireApproval) || false;
  const sessionToken = useRoomStore((s) => s.sessionToken);

  const activeModal = useUIStore((s) => s.activeModal);
  const setActiveModal = useUIStore((s) => s.setActiveModal);
  const isOpen = activeModal === 'settings';
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [maxUsers, setMaxUsers] = useState('10');

  const handleClose = () => setActiveModal('none');

  const updateSetting = async (updates: Record<string, any>) => {
    if (!roomCode || !sessionToken || !isAdmin) return;
    
    setIsUpdating(true);
    try {
      const res = await fetch(`http://localhost:8000/api/rooms/${roomCode}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to update settings');
      toast.success('Room settings updated');
    } catch (err) {
      console.error(err);
      toast.error('Could not update settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearRequests = async () => {
    if (!roomCode || !sessionToken || !isAdmin) return;
    
    try {
      const res = await fetch(`http://localhost:8000/api/rooms/${roomCode}/clear-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      if (!res.ok) throw new Error('Failed to clear requests');
      toast.success('Cleared all pending join requests');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear requests');
    }
  };

  if (!isAdmin) {
    return (
      <Modal open={isOpen} onOpenChange={handleClose}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Room Details</ModalTitle>
            <ModalDescription>You are an attendee. Only the admin can change room settings.</ModalDescription>
          </ModalHeader>
          <div className="py-4 flex justify-center">
             <Shield className="w-16 h-16 text-surface-hover mb-4" />
          </div>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal open={isOpen} onOpenChange={handleClose}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>Room Settings</ModalTitle>
          <ModalDescription>
            Manage permissions, lock the room, and control participant features.
          </ModalDescription>
        </ModalHeader>

        <div className="flex flex-col gap-6 py-4">
          
          {/* Max Users */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Max Participants
              </span>
              <span className="text-xs text-text-secondary">Limit who can join the room.</span>
            </div>
            <Input 
              type="number" 
              className="w-24 bg-background" 
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
              onBlur={() => updateSetting({ max_users: parseInt(maxUsers) })}
            />
          </div>

          <div className="h-px bg-surface-hover w-full" />

          {/* Room Lock */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                <Lock className="w-4 h-4 text-warning" />
                Lock Room
              </span>
              <span className="text-xs text-text-secondary">Prevent any new users from joining.</span>
            </div>
            <Button 
              variant={isLocked ? 'default' : 'outline'} 
              size="sm"
              disabled={isUpdating}
              onClick={() => updateSetting({ is_locked: !isLocked })}
            >
              {isLocked ? 'Locked' : 'Unlocked'}
            </Button>
          </div>

          <div className="h-px bg-surface-hover w-full" />

          {/* Join Approval */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                Require Approval
              </span>
              <span className="text-xs text-text-secondary">Users wait in lobby until admitted.</span>
            </div>
            <Button 
              variant={requireApproval ? 'default' : 'outline'} 
              size="sm"
              disabled={isUpdating}
              onClick={() => updateSetting({ require_approval: !requireApproval })}
            >
              {requireApproval ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {/* Clear Requests */}
          {requireApproval && (
             <div className="flex justify-end mt-[-10px]">
                <Button variant="ghost" size="sm" onClick={handleClearRequests} className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs py-1 h-auto">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear Pending Requests
                </Button>
             </div>
          )}

          <div className="h-px bg-surface-hover w-full" />

          {/* Disable Chat */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Disable Chat
              </span>
              <span className="text-xs text-text-secondary">Turn off text chat for everyone.</span>
            </div>
            <Button 
              variant={chatDisabled ? 'destructive' : 'outline'} 
              size="sm"
              disabled={isUpdating}
              onClick={() => updateSetting({ chat_disabled: !chatDisabled })}
            >
              {chatDisabled ? 'Disabled' : 'Enabled'}
            </Button>
          </div>

        </div>
      </ModalContent>
    </Modal>
  );
}
