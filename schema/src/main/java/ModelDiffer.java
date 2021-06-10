import com.github.difflib.DiffUtils;
import com.github.difflib.UnifiedDiffUtils;
import com.github.difflib.patch.Patch;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.util.FileUtils;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.List;

final class ModelDiffer {
    static List<String> diff(Model expected, Model actual) {
        OutputStream expectedStream = new ByteArrayOutputStream();
        OutputStream actualStream = new ByteArrayOutputStream();

        expected.write(expectedStream, FileUtils.langTurtle);
        actual.write(actualStream, FileUtils.langTurtle);

        List<String> expectedString = Arrays.stream(expectedStream.toString().split("\n")).toList();
        List<String> actualString = Arrays.stream(actualStream.toString().split("\n")).toList();

        Patch<String> diff = DiffUtils.diff(expectedString, actualString);

        return UnifiedDiffUtils.generateUnifiedDiff("expected", "actual", expectedString, diff, 5);
    }
}
