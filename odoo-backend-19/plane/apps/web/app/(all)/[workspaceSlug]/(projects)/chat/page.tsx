/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { PageHead } from "@/components/core/page-title";
import { FullPageChat } from "@/components/chat/full-page-chat";

export default function FullPageChatPage() {
  return (
    <>
      <PageHead title="Chat" />
      <FullPageChat />
    </>
  );
}
