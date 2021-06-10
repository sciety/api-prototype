import java.io.File;

final class TestPass implements TestResult {

    private final File file;

    TestPass(File file) {
        this.file = file;
    }

    public File getFile() {
        return this.file;
    }
}
