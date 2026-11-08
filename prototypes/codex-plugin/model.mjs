// Fictional Knowledge base for the Codex plugin prototype. Never reads a repository.
export const areas = [
  { id: 'workspace', name: 'Workspace', icon: 'workspace', color: 'violet', description: 'The place your team calls home.' },
  { id: 'projects', name: 'Projects', icon: 'folder', color: 'blue', description: 'Turn an idea into work you can follow.' },
  { id: 'collaboration', name: 'Collaboration', icon: 'people', color: 'orange', description: 'Keep everyone moving together.' },
  { id: 'account', name: 'Account & access', icon: 'key', color: 'green', description: 'Your identity, preferences, and access.' },
];

export const parts = [
  ['workspace', 'Workspace', 'The shared space that holds a team’s members and projects.', 'backend', 'src/workspaces/workspace.ts', true],
  ['invitation', 'Invitation', 'An invitation to join one Workspace, with an email address and an expiry date.', 'backend', 'src/invitations/invitation.ts', true],
  ['invite-form', 'Invitation form', 'Collects a teammate’s email address and the role they should receive.', 'screen', 'src/workspaces/invite-dialog.tsx'],
  ['mailer', 'Invitation delivery', 'Sends an email with a secure invitation to a teammate.', 'backend', 'src/invitations/send.ts'],
  ['membership', 'Membership', 'Connects one person to one Workspace with their assigned role.', 'backend', 'src/workspaces/membership.ts', true],
  ['project', 'Project', 'Keeps the name, description, and progress of a team’s work.', 'backend', 'src/projects/project.ts', true],
  ['project-form', 'Project editor', 'Lets a teammate create a Project or change its details.', 'screen', 'src/projects/editor.tsx'],
  ['archive', 'Project archive', 'Hides completed Projects from active work while keeping their content.', 'backend', 'src/projects/archive.ts'],
  ['comment', 'Comment', 'Stores a teammate’s message on a Project.', 'backend', 'src/comments/comment.ts', true],
  ['composer', 'Comment composer', 'Lets a teammate write and publish a message on a Project.', 'screen', 'src/comments/composer.tsx'],
  ['notification', 'Notification delivery', 'Tells a teammate when someone mentions them in a Comment.', 'backend', 'src/notifications/deliver.ts'],
  ['session', 'Sign-in', 'Verifies a sign-in link and starts a secure session.', 'backend', 'src/auth/session.ts'],
  ['profile', 'Profile', 'Keeps a person’s display name, email address, and preferences.', 'backend', 'src/account/profile.ts', true],
  ['profile-form', 'Profile editor', 'Lets a person update how they appear to their team.', 'screen', 'src/account/settings.tsx'],
].map(([id, name, description, side, path, entity]) => ({ id, name, description, entity: Boolean(entity), anchors: [{ label: name, side, path }] }));

const step = (title, actor, sees, system, parts) => ({ title, actor, sees, system, parts });
const qa = (action, expected) => ({ action, expected });
export const flows = [
  { id: 'invite', area: 'workspace', name: 'Invite a teammate', description: 'A workspace owner invites someone to join the team by email.', actor: 'Workspace owner', trigger: 'The owner selects Invite teammate in the Workspace.', preconditions: 'You are signed in as a Workspace owner. The teammate is not already a member.', outcome: 'The invitation appears as pending, and the teammate receives an email.', updated: '12 minutes ago', steps: [
    step('Open the invitation form', 'Selects Invite teammate from the members page.', 'A form asking for an email address and a role.', 'Opens the Invitation form with Member selected by default.', ['invite-form']),
    step('Choose who to invite', 'Enters alex@example.com and selects Member.', 'The email address and the selected role.', 'Validates the email address and checks existing Memberships.', ['invite-form', 'membership']),
    step('Send the invitation', 'Selects Send invitation.', 'A sending indicator, then “Invitation sent”.', 'Creates an Invitation for this Workspace and sends an email that expires in 7 days.', ['invitation', 'workspace', 'mailer']),
    step('See the pending teammate', 'Returns to the members page.', 'The teammate listed as Invited, with the Member role.', 'Includes the pending Invitation in the member list.', ['invitation', 'membership']),
  ], qa: [
    qa('Open Members and select Invite teammate.', 'The invitation form opens with Member selected.'),
    qa('Enter alex@example.com, leave Member selected, and send.', '“Invitation sent” appears and the form closes.'),
    qa('Find alex@example.com in the members list.', 'The teammate is labelled Invited and has the Member role.'),
    qa('Open the invitation email in the demo mailbox.', 'An invitation names the Workspace and expires in 7 days.'),
  ], variants: [
    { name: 'Already a member', at: 2, condition: 'The email belongs to an existing member.', outcome: 'No invitation is created.', steps: [step('Explain why the invitation cannot be sent', '', '“This person is already in your Workspace.”', 'Finds the existing Membership and keeps the form open.', ['membership', 'invite-form'])], qa: [qa('Invite someone who is already a member.', '“This person is already in your Workspace” appears; no invitation is sent.')] },
    { name: 'Email delivery fails', at: 3, condition: 'The email service is unavailable.', outcome: 'The owner can retry sending the invitation.', steps: [step('Offer another attempt', '', '“We couldn’t send this invitation. Try again.”', 'Marks delivery as failed and keeps the Invitation available to retry.', ['mailer', 'invitation'])], qa: [qa('Use the demo email delivery failure setup and send an invitation.', 'An error offers a retry and no success message appears.')] },
  ] },
  { id: 'create-workspace', area: 'workspace', name: 'Create a workspace', description: 'A signed-in person creates a shared home for their team.', actor: 'Signed-in person', trigger: 'Select Create workspace.', preconditions: 'You are signed in.', outcome: 'Your new Workspace opens and you are its owner.', steps: [step('Name your workspace', 'Enters a Workspace name.', 'A preview of the name.', 'Prepares the Workspace details.', ['workspace']), step('Create your workspace', 'Selects Create workspace.', 'The new Workspace with an empty members list.', 'Saves the Workspace and an owner Membership.', ['workspace', 'membership'])], qa: [qa('Enter a name and select Create workspace.', 'The Workspace opens with you as its owner.')] },
  { id: 'roles', area: 'workspace', name: 'Change a member’s role', description: 'An owner changes what a teammate is allowed to do.', toWrite: true },
  { id: 'create-project', area: 'projects', name: 'Create a project', description: 'A teammate starts a Project in their Workspace.', actor: 'Workspace member', trigger: 'Select New project.', preconditions: 'You belong to a Workspace.', outcome: 'The Project appears in the Workspace.', steps: [step('Describe the project', 'Enters a name and description.', 'The new Project form.', 'Collects the details in the Project editor.', ['project-form']), step('Create the project', 'Selects Create project.', 'The new Project page.', 'Saves the Project under the current Workspace.', ['project', 'workspace'])], qa: [qa('Create a Project named Website refresh.', 'Website refresh appears in the Workspace.')] },
  { id: 'edit-project', area: 'projects', name: 'Edit project details', description: 'A teammate changes a Project’s name and description.', actor: 'Workspace member', trigger: 'Select Edit on a Project.', preconditions: 'A Project exists in your Workspace.', outcome: 'The updated details appear to the team.', steps: [step('Edit the details', 'Changes the Project name.', 'The current name and description in an editor.', 'Loads the Project into the Project editor.', ['project', 'project-form']), step('Save the details', 'Selects Save changes.', 'The updated name on the Project page.', 'Saves the changed Project.', ['project'])], qa: [qa('Rename a Project and save.', 'The new name appears on the Project and in the Workspace list.')] },
  { id: 'archive-project', area: 'projects', name: 'Archive a project', description: 'A teammate moves a completed Project out of active work.', actor: 'Workspace member', trigger: 'Select Archive project.', preconditions: 'An active Project exists.', outcome: 'The Project moves to the archive.', steps: [step('Confirm archiving', 'Selects Archive project and confirms.', 'A confirmation describing what will happen.', 'Archives the Project without deleting its content.', ['archive', 'project']), step('Return to active work', '', 'The Project no longer appears in active Projects.', 'Loads active Projects for the Workspace.', ['project', 'workspace'])], qa: [qa('Archive an active Project.', 'It disappears from active Projects and appears in the archive.')] },
  { id: 'comment', area: 'collaboration', name: 'Leave a comment', description: 'A teammate shares an update on a Project.', actor: 'Workspace member', trigger: 'Focus the Comment composer.', preconditions: 'You can access the Project.', outcome: 'Your Comment appears on the Project.', steps: [step('Write your comment', 'Types a message.', 'The message in the Comment composer.', 'Keeps the draft available for submission.', ['composer']), step('Publish the comment', 'Selects Post comment.', 'The Comment, author, and time beneath the Project.', 'Saves the Comment on the Project.', ['comment', 'project'])], qa: [qa('Write “Ready for review” and post it.', 'The Comment appears once with your name.')] },
  { id: 'mention', area: 'collaboration', name: 'Mention a teammate', description: 'A teammate brings someone’s attention to a Comment.', actor: 'Workspace member', trigger: 'Type @ in a Comment.', preconditions: 'Another teammate belongs to the Workspace.', outcome: 'The mentioned teammate receives a notification.', steps: [step('Choose a teammate', 'Types @ and selects a teammate.', 'Matching names from the Workspace.', 'Finds Memberships for the mention picker.', ['composer', 'membership']), step('Notify the teammate', 'Posts the Comment.', 'A highlighted name in the published Comment.', 'Saves the Comment and delivers a notification.', ['comment', 'notification'])], qa: [qa('Mention a teammate and publish the Comment.', 'The teammate receives one notification naming the Project.')] },
  { id: 'notifications', area: 'collaboration', name: 'Manage notifications', description: 'A teammate chooses which updates they want to receive.', toWrite: true },
  { id: 'sign-in', area: 'account', name: 'Sign in with email', description: 'A person signs in using a secure email link.', actor: 'Returning person', trigger: 'Open a sign-in link from email.', preconditions: 'You have requested a valid sign-in link.', outcome: 'Your Workspace opens in a signed-in session.', steps: [step('Verify the sign-in link', 'Opens the link.', 'A brief signing-in message.', 'Validates the link and starts a session.', ['session']), step('Open the workspace', '', 'The most recently visited Workspace.', 'Loads the Profile and its Workspace Memberships.', ['profile', 'membership'])], qa: [qa('Open a fresh sign-in link.', 'Your Workspace opens without asking for a password.')] },
  { id: 'profile', area: 'account', name: 'Update your profile', description: 'A person changes the name their team sees.', actor: 'Signed-in person', trigger: 'Open profile settings.', preconditions: 'You are signed in.', outcome: 'Your new name appears throughout the Workspace.', steps: [step('Edit your name', 'Enters a new display name.', 'The name in profile settings.', 'Loads your Profile into the Profile editor.', ['profile', 'profile-form']), step('Save your profile', 'Selects Save changes.', 'A saved confirmation and the updated name.', 'Updates your Profile.', ['profile'])], qa: [qa('Change your display name and save.', 'The new name appears in your profile and new Comments.')] },
  { id: 'delete-account', area: 'account', name: 'Delete your account', description: 'A person permanently removes their account and access.', toWrite: true },
];

export function searchKnowledgeBase(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return [
    ...flows.map(flow => ({ ...flow, kind: 'Flow' })),
    ...parts.map(part => ({ ...part, kind: 'Part' })),
  ].filter(item => `${item.name} ${item.description}`.toLowerCase().includes(q));
}

export function recordQAResult(results, flow, index, outcome, note = '') {
  if (!['passed', 'failed', 'could not perform'].includes(outcome)) throw new Error('Unknown QA outcome');
  return { ...results, [`${flow}:${index}`]: { outcome, note, commit: 'a81f2c9', recordedAt: new Date().toISOString(), uncommittedChanges: false } };
}
