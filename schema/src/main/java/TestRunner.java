import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.util.FileUtils;
import org.apache.jena.vocabulary.RDF;
import org.topbraid.jenax.util.JenaUtil;
import org.topbraid.shacl.testcases.TestCase;
import org.topbraid.shacl.vocabulary.DASH;
import org.topbraid.shacl.vocabulary.SH;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.OutputStream;
import java.io.PrintStream;
import java.util.NoSuchElementException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class TestRunner {
    static TestResult runTest(TestCase testCase, File file) {
        Model results = JenaUtil.createMemoryModel();

        OutputStream capturedOutput = new ByteArrayOutputStream();
        PrintStream out = System.out;
        System.setOut(new PrintStream(capturedOutput));

        try {
            testCase.run(results);
        } catch (Exception ex) {
            testCase.createFailure(results, "Exception during test case execution: " + ex);
        } finally {
            System.out.flush();
            System.setOut(out);
        }

        Resource result;
        try {
            result = results.listResourcesWithProperty(RDF.type, DASH.FailureTestCaseResult).next();
        } catch (NoSuchElementException exception) {
            return new TestPass(file); // TODO should really check for a DASH.SuccessTestCaseResult
        }

        Pattern pattern = Pattern.compile("^Expected: (.*)\nActual: (.*)$", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(capturedOutput.toString());
        if (!matcher.find()) {
            throw new RuntimeException("No output captured");
        }

        String message = JenaUtil.getStringProperty(result, SH.resultMessage);

        Model expected = JenaUtil.createMemoryModel();
        expected.read(new ByteArrayInputStream(matcher.group(1).getBytes()), null, FileUtils.langTurtle);
        Model actual = JenaUtil.createMemoryModel();
        actual.read(new ByteArrayInputStream(matcher.group(2).getBytes()), null, FileUtils.langTurtle);
        actual.setNsPrefix("", "file://" + file.getParentFile().getAbsolutePath() + "/");
        expected.setNsPrefixes(actual.getNsPrefixMap());

        return new TestFail(file, message, expected, actual);
    }
}
