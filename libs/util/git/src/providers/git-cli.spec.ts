import * as simpleGit from "simple-git";

import { GitCli } from "./git-cli";
import { MockedLogger } from "@amplication/util/logging/test-utils";
import { UpdateFile } from "../types";

const gitFetchMock = jest.fn();
const gitBranchMock = jest.fn();
const gitCheckoutLocalBranchMock = jest.fn();
const gitCheckoutMock = jest.fn();
const gitStatusMock = jest.fn();
const gitCommitMock = jest.fn();
const gitPushMock = jest.fn();

jest.mock("simple-git");
jest.mock("node:fs/promises");

const simpleGitMocked = simpleGit as jest.Mocked<typeof simpleGit>;

describe("GitCli", () => {
  let gitCli: GitCli;

  beforeEach(() => {
    simpleGitMocked.simpleGit.mockReturnValue({
      fetch: gitFetchMock,
      branch: gitBranchMock,
      checkoutLocalBranch: gitCheckoutLocalBranchMock,
      checkout: gitCheckoutMock,
      status: gitStatusMock,
      commit: gitCommitMock,
      push: gitPushMock,
      add: jest.fn(),
    } as unknown as simpleGit.SimpleGit);

    gitCli = new GitCli(MockedLogger, {
      originUrl: "http://example.com",
      repositoryDir: "repository-dir",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  describe("checkout", () => {
    it("should checkout a local branch if remote branch does not exist", async () => {
      gitFetchMock.mockResolvedValue(undefined);
      gitBranchMock.mockResolvedValue({ all: [] });

      const branchName = "my-branch";

      await gitCli.checkout(branchName);

      expect(gitFetchMock).toHaveBeenCalledTimes(1);
      expect(gitBranchMock).toHaveBeenCalledTimes(1);
      expect(gitCheckoutLocalBranchMock).toHaveBeenCalledWith(branchName);
      expect(gitCheckoutMock).not.toHaveBeenCalled();
    });

    it("should checkout a remote branch if it exists", async () => {
      gitFetchMock.mockResolvedValue(undefined);
      gitBranchMock.mockResolvedValue({ all: ["origin/my-branch"] });

      const branchName = "my-branch";
      await gitCli.checkout(branchName);

      expect(gitFetchMock).toHaveBeenCalledTimes(1);
      expect(gitBranchMock).toHaveBeenCalledTimes(1);
      expect(gitCheckoutLocalBranchMock).not.toHaveBeenCalled();
      expect(gitCheckoutMock).toHaveBeenCalledWith(branchName);
    });

    it("should always perform a fetch before checking the remote branch existence", async () => {
      gitFetchMock.mockResolvedValue(undefined);
      gitBranchMock.mockResolvedValue({ all: ["origin/my-branch"] });

      const branchName = "my-branch";
      await gitCli.checkout(branchName);

      expect(gitFetchMock).toHaveBeenCalledTimes(1);
      expect(gitBranchMock).toHaveBeenCalledTimes(1);
      expect(gitCheckoutLocalBranchMock).not.toHaveBeenCalled();
      expect(gitCheckoutMock).toHaveBeenCalledWith(branchName);
    });
  });

  describe("commit", () => {
    beforeEach(() => {
      gitFetchMock.mockResolvedValue(undefined);
      gitBranchMock.mockResolvedValue({ all: ["origin/main"] });
    });

    it("should commit changes and return the commit SHA", async () => {
      // Mock the necessary functions
      gitCheckoutMock.mockResolvedValueOnce(undefined);
      gitStatusMock.mockResolvedValueOnce({
        staged: ["file1.txt"],
        renamed: [],
      });
      gitCommitMock.mockResolvedValueOnce({ commit: "abcd1234" });
      gitPushMock.mockResolvedValueOnce(undefined);

      const branchName = "main";
      const message = "Commit message";
      const files: UpdateFile[] = [
        {
          path: "file1.txt",
          content: "File content",
          deleted: false,
          skipIfExists: false,
        },
      ];

      const result = await gitCli.commit(branchName, message, files);

      expect(gitCheckoutMock).toHaveBeenCalledWith(branchName);
      expect(gitStatusMock).toHaveBeenCalled();
      expect(gitCommitMock).toHaveBeenCalledWith(message);
      expect(gitPushMock).toHaveBeenCalled();
      expect(result).toBe("abcd1234");
    });

    it("should log a warning and return an empty string if no changes to commit", async () => {
      // Mock the necessary functions
      gitCheckoutMock.mockResolvedValueOnce(undefined);
      gitStatusMock.mockResolvedValueOnce({
        staged: [],
        renamed: [],
      });

      const branchName = "main";
      const message = "Commit message";
      const files: UpdateFile[] = [];

      const result = await gitCli.commit(branchName, message, files);

      expect(gitCheckoutMock).toHaveBeenCalledWith(branchName);
      expect(gitStatusMock).toHaveBeenCalled();
      expect(gitCommitMock).not.toHaveBeenCalled();
      expect(gitPushMock).not.toHaveBeenCalled();
      expect(result).toBe("");
      expect(gitCli["logger"].warn).toHaveBeenCalled();
    });

    it("should handle file deletions", async () => {
      // Mock the necessary functions
      gitCheckoutMock.mockResolvedValueOnce(undefined);
      gitStatusMock.mockResolvedValueOnce({
        staged: ["file1.txt"],
        renamed: [],
      });
      gitCommitMock.mockResolvedValueOnce({ commit: "abcd1234" });
      gitPushMock.mockResolvedValueOnce(undefined);

      const branchName = "main";
      const message = "Commit message";
      const files: UpdateFile[] = [
        { path: "file1.txt", deleted: true, content: "", skipIfExists: false },
      ];

      const result = await gitCli.commit(branchName, message, files);

      expect(gitCheckoutMock).toHaveBeenCalledWith(branchName);
      expect(gitStatusMock).toHaveBeenCalled();
      expect(gitCommitMock).toHaveBeenCalledWith(message);
      expect(gitPushMock).toHaveBeenCalled();
      expect(result).toBe("abcd1234");
    });

    it("should handle file creation and skipping if already exists", async () => {
      // Mock the necessary functions
      gitCheckoutMock.mockResolvedValueOnce(undefined);
      gitStatusMock.mockResolvedValueOnce({
        staged: ["file1.txt"],
        renamed: [],
      });
      gitCommitMock.mockResolvedValueOnce({ commit: "abcd1234" });
      gitPushMock.mockResolvedValueOnce(undefined);

      const branchName = "main";
      const message = "Commit message";
      const files: UpdateFile[] = [
        {
          path: "file1.txt",
          content: "File content",
          skipIfExists: true,
          deleted: false,
        },
      ];

      const result = await gitCli.commit(branchName, message, files);

      expect(gitCheckoutMock).toHaveBeenCalledWith(branchName);
      expect(gitStatusMock).toHaveBeenCalled();
      expect(gitCommitMock).toHaveBeenCalledWith(message);
      expect(gitPushMock).toHaveBeenCalled();
      expect(result).toBe("abcd1234");
    });
  });
});
