import org.apache.jena.rdf.model.Model;

import java.io.File;

final class TestFail implements TestResult {
    private final Model expected;
    private final Model actual;
    private final File file;
    private final String message;

    TestFail(File file, String message, Model expected, Model actual) {
        this.file = file;
        this.message = message;
        this.expected = expected;
        this.actual = actual;
    }

    public File getFile() {
        return file;
    }

    public String getMessage() {
        return message;
    }

    public Model getExpected() {
        return expected;
    }

    public Model getActual() {
        return actual;
    }
}
